/** Bounded warm-instance cache. Not a distributed quota or global deduplicator. */
export function referenceCache({max=200,ttl=300_000,negativeTtl=30_000,now=Date.now}={}) {
  const entries=new Map(),pending=new Map();
  return {
    async get(key,load,cacheable=()=>true,negative=()=>false) {
      const hit=entries.get(key);
      if(hit && hit.expires>now()) return structuredClone(hit.value);
      entries.delete(key);
      if(pending.has(key)) return structuredClone(await pending.get(key));
      const work=(async()=>{
        const value=await load();
        if(cacheable(value)) {
          if(entries.size>=max) entries.delete(entries.keys().next().value);
          entries.set(key,{value:structuredClone(value),expires:now()+(negative(value)?negativeTtl:ttl)});
        }
        return value;
      })();
      // Above the in-flight bound, run uncached rather than retaining more keys.
      if (pending.size >= max) return structuredClone(await work);
      pending.set(key,work);
      try{return structuredClone(await work);}finally{pending.delete(key);}
    },
    clear(){entries.clear();},
  };
}
