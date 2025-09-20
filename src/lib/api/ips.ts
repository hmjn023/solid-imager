export async function getIps() {
	console.log("Placeholder: getIps called");
	return [];
}

export async function createIp(name: string, description?: string) {
	console.log("Placeholder: createIp called", { name, description });
	return { id: 1, name, description };
}

export async function getIpById(id: number) {
	console.log("Placeholder: getIpById called", { id });
	return { id, name: `IP ${id}`, description: `Description for IP ${id}` };
}

export async function updateIp(
	id: number,
	name?: string,
	description?: string,
) {
	console.log("Placeholder: updateIp called", { id, name, description });
	return {
		id,
		name: name || `IP ${id}`,
		description: description || `Description for IP ${id}`,
	};
}

export async function deleteIp(id: number) {
	console.log("Placeholder: deleteIp called", { id });
	return { success: true };
}
