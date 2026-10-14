import { useMemo } from 'react';
import { navigate, useVault } from '../hooks/app';
import type { GraphLink, GraphNode } from '../scenes/GraphScene';

export type GraphOptions = { tags?: boolean; orphans?: boolean; missing?: boolean };

/** Nodes & links for the Constellation, rebuilt only when link structure changes. */
export function useGraphData({ tags = true, orphans = true, missing = false }: GraphOptions = {}) {
  const vault = useVault();
  const index = vault.index();
  const structureKey = [...index.outgoing.entries()].map(([k, o]) => k + o.join()).join('|') + [...index.tags.keys()].join() + [...index.unresolved.keys()].join() + vault.list().map((m) => m.title).join();

  const graph = useMemo(() => {
    const live = vault.list().filter((m) => !m.trashed);
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const degree = new Map<string, number>();
    const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);
    for (const m of live) for (const to of index.outgoing.get(m.id) ?? []) (links.push({ source: m.id, target: to }), bump(m.id), bump(to));
    if (tags) for (const [tag, ids] of index.tags) for (const id of ids) (links.push({ source: id, target: `tag:${tag}` }), bump(id), bump(`tag:${tag}`));
    if (missing) for (const [title, from] of index.unresolved) for (const id of from) (links.push({ source: id, target: `missing:${title}` }), bump(id), bump(`missing:${title}`));
    for (const m of live) if (orphans || degree.get(m.id)) nodes.push({ id: m.id, title: m.title, kind: 'note', degree: degree.get(m.id) ?? 0 });
    if (tags) for (const tag of index.tags.keys()) nodes.push({ id: `tag:${tag}`, title: tag, kind: 'tag', degree: degree.get(`tag:${tag}`) ?? 0 });
    if (missing) for (const title of index.unresolved.keys()) nodes.push({ id: `missing:${title}`, title, kind: 'missing', degree: degree.get(`missing:${title}`) ?? 0 });
    return { nodes, links };
  }, [structureKey, tags, orphans, missing]);

  const open = (nd: GraphNode) => {
    if (nd.kind === 'note') navigate({ name: 'note', id: nd.id });
    else if (nd.kind === 'tag') navigate({ name: 'tag', tag: nd.title });
    else navigate({ name: 'note', id: vault.create(nd.title, '') });
  };

  return { ...graph, open };
}
