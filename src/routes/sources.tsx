import { createResource,For } from "solid-js"
import SourceCard from "~/components/source-card"
import { getMediaSources } from "~/lib/api/sources"

export default function Sources() {
  const [mediaSources, { mutate, refetch }]= createResource(getMediaSources)
  return (
    <For each={mediaSources()}>
      {(mediaSource) => <SourceCard mediaSource={mediaSource} />}
    </For>
  )
}
