/* Native disclosures remain the fallback. A supported dialog keeps focus and all selection
   state in this page only; no cause choice is sent, stored or added to the address. */
for (const gallery of document.querySelectorAll("[data-ribbon-gallery]")) {
  const dialog=gallery.querySelector("[data-ribbon-dialog]"), title=gallery.querySelector("[data-ribbon-title]"), body=gallery.querySelector("[data-ribbon-body]");
  if (!dialog || !title || !body || typeof dialog.showModal!=="function") continue;
  let opener=null, top=0;
  for(const card of gallery.querySelectorAll(".ribbon-card")) {
    const summary=card.querySelector("summary"), content=card.querySelector(".ribbon-details");
    if(!summary||!content)continue;
    summary.setAttribute("aria-haspopup","dialog");
    summary.addEventListener("click",event=>{
      event.preventDefault(); opener=summary; top=window.scrollY;
      title.textContent=card.querySelector(".ribbon-name")?.textContent||"";
      const copy=content.cloneNode(true);
      // Each cloned vector gets its own paint-server IDs, even while its original remains in the card.
      const ids=new Map();
      for(const node of copy.querySelectorAll("[id]")){const old=node.id, next=old+"-modal";ids.set(old,next);node.id=next;}
      for(const node of copy.querySelectorAll("[fill]")){
        const fill=node.getAttribute("fill"), key=fill?.match(/^url\(#(.+)\)$/)?.[1];
        if(ids.has(key))node.setAttribute("fill",`url(#${ids.get(key)})`);
      }
      body.replaceChildren(copy); dialog.showModal(); document.documentElement.classList.add("ribbon-pinned");
    });
  }
  gallery.querySelector("[data-ribbon-close]")?.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("keydown",event=>{
    if(event.key!=="Tab")return;
    const stops=[...dialog.querySelectorAll('button:not([disabled]),a[href]')].filter(n=>n.getClientRects().length);
    const first=stops[0],last=stops.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
  dialog.addEventListener("click",event=>{
    const r=dialog.getBoundingClientRect();
    if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();
  });
  dialog.addEventListener("close",()=>{body.replaceChildren();document.documentElement.classList.remove("ribbon-pinned");window.scrollTo(0,top);opener?.focus({preventScroll:true});});
}
