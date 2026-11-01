/**
 * Sparse HDBSCAN*: union kNN -> mutual reachability -> minimum spanning forest
 * -> condensed hierarchy -> EOM/leaf selection. No dense N-by-N allocation.
 *
 * Algorithm: Campello et al., https://doi.org/10.1007/978-3-642-37456-2_14
 * The independently implemented typed-array pipeline is checked against saved
 * scikit-learn-contrib/hdbscan results. Supported selection excludes each root.
 */
export type SparseDistanceGraph = {
	pointCount: number;
	offsets: Int32Array;
	indices: Int32Array;
	distances: Float64Array;
};

export type SparseHdbscanOptions = {
	minClusterSize: number;
	minSamples: number;
	selectionMethod: "eom" | "leaf";
};

export type SparseHdbscanResult = {
	labels: Int32Array;
	membershipStrengths: Float64Array;
	persistence: Float64Array;
	componentSizes: number[];
	graphEdges: number;
	timings: { hierarchyMs: number; selectionMs: number };
};

/** Build a sorted, symmetric CSR graph, deduplicating reciprocal edges by max. */
export function buildNeighborGraph(
	indices: Int32Array,
	distances: Float64Array,
	pointCount: number,
	slots: number,
	neighbors: number,
): SparseDistanceGraph {
	if (
		!Number.isSafeInteger(pointCount) ||
		pointCount < 1 ||
		!Number.isSafeInteger(slots) ||
		slots < 1 ||
		!Number.isSafeInteger(neighbors) ||
		neighbors < 1 ||
		neighbors > slots ||
		indices.length !== pointCount * slots ||
		distances.length !== indices.length ||
		pointCount * neighbors * 2 > 0x7fffffff
	)
		throw new Error("Invalid neighbor graph dimensions");
	const rawOffsets = new Int32Array(pointCount + 1);
	for (let i = 0; i < pointCount; i++) {
		const seen = new Set<number>();
		for (let k = 0; k < neighbors; k++) {
			const position = i * slots + k;
			const j = indices[position];
			const d = distances[position];
			if (
				j < 0 ||
				j >= pointCount ||
				j === i ||
				seen.has(j) ||
				!Number.isFinite(d) ||
				d < 0 ||
				d > 2.000001 ||
				(k > 0 && d < distances[position - 1])
			) {
				throw new Error("Invalid, duplicate, unsorted or incomplete neighbors");
			}
			seen.add(j);
			rawOffsets[i + 1]++;
			rawOffsets[j + 1]++;
		}
	}
	for (let i = 1; i <= pointCount; i++) rawOffsets[i] += rawOffsets[i - 1];
	const columns = new Int32Array(rawOffsets[pointCount]);
	const weights = new Float64Array(columns.length);
	const cursor = rawOffsets.slice();
	for (let i = 0; i < pointCount; i++) {
		for (let k = 0; k < neighbors; k++) {
			const position = i * slots + k;
			const j = indices[position];
			const d = Math.max(distances[position], 1e-12);
			const forward = cursor[i]++;
			const reverse = cursor[j]++;
			columns[forward] = j;
			weights[forward] = d;
			columns[reverse] = i;
			weights[reverse] = d;
		}
	}
	const offsets = new Int32Array(pointCount + 1);
	let used = 0;
	const order: number[] = [];
	const uniqueColumns: number[] = [];
	const uniqueWeights: number[] = [];
	for (let i = 0; i < pointCount; i++) {
		order.length = 0;
		uniqueColumns.length = 0;
		uniqueWeights.length = 0;
		for (let p = rawOffsets[i]; p < rawOffsets[i + 1]; p++) order.push(p);
		order.sort((a, b) => columns[a] - columns[b]);
		for (const p of order) {
			const last = uniqueColumns.length - 1;
			if (last >= 0 && uniqueColumns[last] === columns[p]) {
				uniqueWeights[last] = Math.max(uniqueWeights[last], weights[p]);
			} else {
				uniqueColumns.push(columns[p]);
				uniqueWeights.push(weights[p]);
			}
		}
		offsets[i] = used;
		// Materialize the row before compacting: writes can overlap its old data.
		for (let j = 0; j < uniqueColumns.length; j++) {
			columns[used] = uniqueColumns[j];
			weights[used++] = uniqueWeights[j];
		}
	}
	offsets[pointCount] = used;
	return {
		pointCount,
		offsets,
		indices: columns.subarray(0, used),
		distances: weights.subarray(0, used),
	};
}

class DisjointSet {
	readonly parents: Int32Array;
	private readonly ranks: Uint8Array;
	constructor(count: number) {
		this.parents = Int32Array.from({ length: count }, (_, i) => i);
		this.ranks = new Uint8Array(count);
	}
	find(point: number): number {
		let root = point;
		while (this.parents[root] !== root) root = this.parents[root];
		while (point !== root) {
			const next = this.parents[point];
			this.parents[point] = root;
			point = next;
		}
		return root;
	}
	join(a: number, b: number): number {
		a = this.find(a);
		b = this.find(b);
		if (a === b) return a;
		if (this.ranks[a] < this.ranks[b]) [a, b] = [b, a];
		this.parents[b] = a;
		if (this.ranks[a] === this.ranks[b]) this.ranks[a]++;
		return a;
	}
}

type Hierarchy = {
	left: Int32Array;
	right: Int32Array;
	size: Int32Array;
	distance: Float64Array;
	roots: number[];
	graphEdges: number;
};

function buildHierarchy(
	graph: SparseDistanceGraph,
	minSamples: number,
	minClusterSize: number,
): Hierarchy {
	const { pointCount: n, offsets, indices, distances } = graph;
	if (
		offsets.length !== n + 1 ||
		offsets[0] !== 0 ||
		offsets[n] !== indices.length ||
		indices.length !== distances.length
	) {
		throw new Error("Invalid CSR dimensions");
	}
	const connectivity = new DisjointSet(n);
	let edgeCount = 0;
	for (let i = 0; i < n; i++) {
		if (offsets[i] > offsets[i + 1]) throw new Error("Invalid CSR offsets");
		for (let p = offsets[i]; p < offsets[i + 1]; p++) {
			const j = indices[p];
			if (
				j < 0 ||
				j >= n ||
				j === i ||
				!Number.isFinite(distances[p]) ||
				distances[p] <= 0 ||
				(p > offsets[i] && indices[p - 1] >= j)
			)
				throw new Error("Invalid sorted sparse distances");
			let low = offsets[j];
			let high = offsets[j + 1];
			while (low < high) {
				const middle = (low + high) >>> 1;
				if (indices[middle] < i) low = middle + 1;
				else high = middle;
			}
			if (
				low >= offsets[j + 1] ||
				indices[low] !== i ||
				distances[low] !== distances[p]
			)
				throw new Error("Sparse graph must be symmetric");
			if (i < j) {
				connectivity.join(i, j);
				edgeCount++;
			}
		}
	}
	const componentSize = new Int32Array(n);
	for (let i = 0; i < n; i++) componentSize[connectivity.find(i)]++;
	const core = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		const values = distances.slice(offsets[i], offsets[i + 1]);
		const size = componentSize[connectivity.find(i)];
		if (values.length < minSamples) {
			if (size >= minClusterSize && size > minSamples)
				throw new Error("Some points have fewer than minSamples neighbors");
			core[i] = Infinity;
		} else {
			values.sort();
			core[i] = values[minSamples - 1];
		}
	}
	const a = new Int32Array(edgeCount);
	const b = new Int32Array(edgeCount);
	const weights = new Float64Array(edgeCount);
	let edge = 0;
	for (let i = 0; i < n; i++) {
		for (let p = offsets[i]; p < offsets[i + 1]; p++) {
			const j = indices[p];
			if (i < j) {
				a[edge] = i;
				b[edge] = j;
				weights[edge++] = Math.max(core[i], core[j], distances[p]);
			}
		}
	}
	const order = Uint32Array.from({ length: edgeCount }, (_, i) => i);
	// Canonical tie order mirrors the CSR-order Kruskal scan. Equal-weight
	// spanning trees can still produce a different binary hierarchy elsewhere.
	order.sort((i, j) => weights[i] - weights[j] || a[i] - a[j] || b[i] - b[j]);
	const left = new Int32Array(2 * n - 1).fill(-1);
	const right = new Int32Array(2 * n - 1).fill(-1);
	const size = new Int32Array(2 * n - 1);
	size.fill(1, 0, n);
	const distance = new Float64Array(2 * n - 1);
	const sets = new DisjointSet(n);
	const node = Int32Array.from({ length: n }, (_, i) => i);
	let next = n;
	for (const e of order) {
		const x = sets.find(a[e]);
		const y = sets.find(b[e]);
		if (x === y) continue;
		left[next] = node[x];
		right[next] = node[y];
		size[next] = size[node[x]] + size[node[y]];
		distance[next] = weights[e];
		const root = sets.join(x, y);
		node[root] = next++;
	}
	const roots: number[] = [];
	for (let i = 0; i < n; i++) if (sets.find(i) === i) roots.push(node[i]);
	return { left, right, size, distance, roots, graphEdges: edgeCount };
}

function selectClusters(
	hierarchy: Hierarchy,
	n: number,
	options: SparseHdbscanOptions,
) {
	const { left, right, size, distance, roots } = hierarchy;
	const parent: number[] = [];
	const children: number[][] = [];
	const birth: number[] = [];
	const death: number[] = [];
	const stability: number[] = [];
	const component: number[] = [];
	const maxima: number[] = [];
	const pointParent = new Int32Array(n).fill(-1);
	const pointLambda = new Float64Array(n);
	const addCluster = (p: number, lambda: number, c: number): number => {
		const id = parent.length;
		parent.push(p);
		children.push([]);
		birth.push(lambda);
		death.push(0);
		stability.push(0);
		component.push(c);
		if (p >= 0) children[p].push(id);
		return id;
	};
	const nodes: number[] = [];
	const clusters: number[] = [];
	const drop = (root: number, cluster: number, lambda: number) => {
		const stack = [root];
		while (stack.length) {
			const node = stack.pop();
			if (node === undefined) break;
			if (node < n) {
				pointParent[node] = cluster;
				pointLambda[node] = lambda;
			} else stack.push(left[node], right[node]);
		}
	};
	for (let c = 0; c < roots.length; c++) {
		const root = roots[c];
		maxima.push(0);
		if (size[root] < options.minClusterSize || size[root] <= options.minSamples)
			continue;
		nodes.length = 0;
		clusters.length = 0;
		nodes.push(root);
		clusters.push(addCluster(-1, 0, c));
		for (let position = 0; position < nodes.length; position++) {
			const node = nodes[position];
			const cluster = clusters[position];
			const a = left[node];
			const b = right[node];
			const lambda = 1 / Math.max(distance[node], 1e-12);
			maxima[c] = Math.max(maxima[c], lambda);
			death[cluster] = Math.max(death[cluster], lambda);
			const aLarge = size[a] >= options.minClusterSize;
			const bLarge = size[b] >= options.minClusterSize;
			if (aLarge && bLarge) {
				stability[cluster] += (lambda - birth[cluster]) * size[node];
				nodes.push(a, b);
				clusters.push(
					addCluster(cluster, lambda, c),
					addCluster(cluster, lambda, c),
				);
			} else if (aLarge || bLarge) {
				const small = aLarge ? b : a;
				const large = aLarge ? a : b;
				stability[cluster] += (lambda - birth[cluster]) * size[small];
				drop(small, cluster, lambda);
				nodes.push(large);
				clusters.push(cluster);
			} else {
				stability[cluster] += (lambda - birth[cluster]) * size[node];
				drop(node, cluster, lambda);
			}
		}
	}
	const best = new Float64Array(parent.length);
	const choose = new Uint8Array(parent.length);
	for (let i = parent.length - 1; i >= 0; i--) {
		let descendants = 0;
		for (const child of children[i]) descendants += best[child];
		choose[i] = Number(
			parent[i] >= 0 &&
				(options.selectionMethod === "leaf"
					? children[i].length === 0
					: stability[i] >= descendants),
		);
		best[i] = choose[i] ? stability[i] : descendants;
	}
	const target = new Int32Array(parent.length).fill(-1);
	const labelByCluster = new Int32Array(parent.length).fill(-1);
	const selected: number[] = [];
	for (let i = 0; i < parent.length; i++) {
		const inherited = parent[i] < 0 ? -1 : target[parent[i]];
		if (inherited >= 0) target[i] = inherited;
		else if (choose[i]) {
			target[i] = i;
			labelByCluster[i] = selected.length;
			selected.push(i);
		}
	}
	const labels = new Int32Array(n).fill(-1);
	const membershipStrengths = new Float64Array(n);
	const counts = new Int32Array(selected.length);
	for (let i = 0; i < n; i++) {
		const cluster = pointParent[i] < 0 ? -1 : target[pointParent[i]];
		if (cluster < 0) continue;
		labels[i] = labelByCluster[cluster];
		counts[labels[i]]++;
		membershipStrengths[i] =
			death[cluster] === 0
				? 1
				: Math.min(pointLambda[i], death[cluster]) / death[cluster];
	}
	const persistence = Float64Array.from(selected, (id, label) => {
		const maximum = maxima[component[id]];
		return maximum === 0 || counts[label] === 0
			? 1
			: stability[id] / (counts[label] * maximum);
	});
	return { labels, membershipStrengths, persistence };
}

/** Fit on a sorted symmetric CSR graph; points in small components remain noise. */
export function fitSparseHdbscan(
	graph: SparseDistanceGraph,
	options: SparseHdbscanOptions,
): SparseHdbscanResult {
	if (
		!Number.isSafeInteger(graph.pointCount) ||
		graph.pointCount < 1 ||
		!Number.isSafeInteger(options.minClusterSize) ||
		options.minClusterSize < 2 ||
		!Number.isSafeInteger(options.minSamples) ||
		options.minSamples < 1 ||
		!["eom", "leaf"].includes(options.selectionMethod)
	)
		throw new Error("Invalid HDBSCAN parameters");
	const started = performance.now();
	const hierarchy = buildHierarchy(
		graph,
		options.minSamples,
		options.minClusterSize,
	);
	const hierarchyDone = performance.now();
	const result = selectClusters(hierarchy, graph.pointCount, options);
	return {
		...result,
		graphEdges: hierarchy.graphEdges,
		componentSizes: hierarchy.roots
			.map((root) => hierarchy.size[root])
			.sort((a, b) => b - a),
		timings: {
			hierarchyMs: hierarchyDone - started,
			selectionMs: performance.now() - hierarchyDone,
		},
	};
}
