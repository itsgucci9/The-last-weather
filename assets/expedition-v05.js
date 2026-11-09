/* The Last Weather v0.5 — source for the expedition journal and passage reveal.
 * No dependencies beyond the React runtime supplied by the original build.
 * Save IDs remain independent of translated text; original v1 saves stay intact.
 */
export const extras = {
  en: { log:'Journal', title:'Expedition journal', journey:'Your choices', archive:'Discovered passages', empty:'Your journey begins here.', archiveEmpty:'Read a passage to add it to your journal.', close:'Close', show:'Open full journal', recent:'Recent choices', count:'{n} choices made', progress:'{n} passages discovered', fatal:'Ends run', version:'Version 0.5', reveal:'Reveal passage', motion:'Visual effects', motionOn:'On', motionOff:'Off' },
  es: { log:'Diario', title:'Diario de expedición', journey:'Tus decisiones', archive:'Pasajes descubiertos', empty:'Tu viaje empieza aquí.', archiveEmpty:'Lee un pasaje para añadirlo a tu diario.', close:'Cerrar', show:'Abrir el diario completo', recent:'Últimas decisiones', count:'{n} decisiones tomadas', progress:'{n} pasajes descubiertos', fatal:'Fin de partida', version:'Versión 0.5', reveal:'Mostrar el pasaje', motion:'Efectos visuales', motionOn:'Activados', motionOff:'Desactivados' },
  fr: { log:'Journal', title:'Journal d’expédition', journey:'Vos décisions', archive:'Passages découverts', empty:'Votre voyage commence ici.', archiveEmpty:'Lisez un passage pour l’ajouter au journal.', close:'Fermer', show:'Ouvrir le journal complet', recent:'Dernières décisions', count:'{n} décisions prises', progress:'{n} passages découverts', fatal:'Fin de partie', version:'Version 0.5', reveal:'Afficher le passage', motion:'Effets visuels', motionOn:'Activés', motionOff:'Désactivés' },
  it: { log:'Diario', title:'Diario di spedizione', journey:'Le tue scelte', archive:'Passaggi scoperti', empty:'Il tuo viaggio inizia qui.', archiveEmpty:'Leggi un passaggio per aggiungerlo al diario.', close:'Chiudi', show:'Apri il diario completo', recent:'Ultime scelte', count:'{n} scelte compiute', progress:'{n} passaggi scoperti', fatal:'Fine partita', version:'Versione 0.5', reveal:'Mostra il passaggio', motion:'Effetti visivi', motionOn:'Attivi', motionOff:'Disattivi' },
  pt: { log:'Diário', title:'Diário de expedição', journey:'Suas escolhas', archive:'Passagens descobertas', empty:'Sua jornada começa aqui.', archiveEmpty:'Leia uma passagem para adicioná-la ao diário.', close:'Fechar', show:'Abrir o diário completo', recent:'Últimas escolhas', count:'{n} escolhas feitas', progress:'{n} passagens descobertas', fatal:'Fim da partida', version:'Versão 0.5', reveal:'Revelar passagem', motion:'Efeitos visuais', motionOn:'Ativados', motionOff:'Desativados' },
};
for(const [code,words] of Object.entries({"en": {"supplies": "Starting supplies", "storyMode": "Story", "survivalMode": "Survival", "suppliesHint": "Story: extra air and time. Survival: original supplies. Applies to new runs only."}, "es": {"supplies": "Suministros iniciales", "storyMode": "Historia", "survivalMode": "Supervivencia", "suppliesHint": "Historia: más aire y tiempo. Supervivencia: suministros originales. Solo para nuevas partidas."}, "fr": {"supplies": "Réserves de départ", "storyMode": "Histoire", "survivalMode": "Survie", "suppliesHint": "Histoire : plus d’air et de temps. Survie : réserves d’origine. Pour les nouvelles parties uniquement."}, "it": {"supplies": "Scorte iniziali", "storyMode": "Storia", "survivalMode": "Sopravvivenza", "suppliesHint": "Storia: più aria e tempo. Sopravvivenza: scorte originali. Solo per le nuove partite."}, "pt": {"supplies": "Suprimentos iniciais", "storyMode": "História", "survivalMode": "Sobrevivência", "suppliesHint": "História: mais ar e tempo. Sobrevivência: suprimentos originais. Só para novas partidas."}})) Object.assign(extras[code],words);
const ARCHIVE_KEY = 'the-last-weather:codex:v1';
const EFFECTS_KEY = 'the-last-weather:visuals:v1';
const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const write = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); } catch { /* original game reports unavailable storage */ } };
const format = (s,n) => s.replace('{n}',n);

export function createExpedition(React, jsxRuntime) {
  const {createElement:h, useState, useEffect, useLayoutEffect, useRef} = React;
  function Journey({story,session,short=false}) {
    const history = (session?.history || []).map((item,index) => {
      const scene=story.scenes.find(s=>s.id===item.sceneId);
      const choice=scene?.choices?.find(c=>c.id===item.choiceId);
      return scene && choice ? {scene,choice,index} : null;
    }).filter(Boolean);
    return h('ol',{className:'journey-list',start:short?Math.max(1,history.length-2):1},
      (short?history.slice(-3):history).map(({scene,choice,index})=>h('li',{key:index},
        h('span',{className:'journey-scene'},scene.title),h('span',{className:'journey-choice'},choice.label))));
  }
  function useExpedition({story,session,lang,inGame,callsign}) {
    const ui=extras[lang]||extras.en;
    const [open,setOpen]=useState(false);
    const [tab,setTab]=useState('journey');
    const [ids,setIds]=useState(()=>{const a=read(ARCHIVE_KEY);return Array.isArray(a)?a.filter(id=>typeof id==='string'&&story.scenes.some(s=>s.id===id)):[]});
    const [effects,setEffects]=useState(()=>read(EFFECTS_KEY)!==false);
    const dialogRef=useRef(null);
    const opener=useRef(null);
    const sceneId=session?.sceneId;
    useEffect(()=>{
      if(!inGame||!session)return;
      setIds(old=>{const next=[...new Set([...old,...session.history.map(s=>s.sceneId),sceneId])].filter(id=>story.scenes.some(s=>s.id===id));
        if(next.length===old.length)return old;
        write(ARCHIVE_KEY,next);return next;});
    },[inGame,sceneId,session]);
    useEffect(()=>{
      const dialog=dialogRef.current;
      if(open&&!dialog?.open)dialog?.showModal();
      if(!open&&dialog?.open)dialog.close();
    },[open]);
    useEffect(()=>{document.documentElement.dataset.visuals=effects?'on':'off';write(EFFECTS_KEY,effects);},[effects]);
    useEffect(()=>{if(!inGame)setOpen(false)},[inGame]);
    useLayoutEffect(()=>{
      if(!inGame||!session){document.documentElement.dataset.weather='quiet';return;}
      const active=session.state.escape==='none';
      const clock=session.state.stormClock;
      document.documentElement.dataset.weather=active?(clock<=2?'severe':clock<=4?'rising':'calm'):'quiet';
      document.documentElement.dataset.runOver=story.scenes.find(s=>s.id===sceneId)?.death?'true':'false';
    },[inGame,sceneId,session]);
    const close=()=>{setOpen(false);requestAnimationFrame(()=>opener.current?.isConnected&&opener.current.focus())};
    const openLog=(event)=>{opener.current=event.currentTarget;setOpen(true)};
    const summary=h('section',{className:'journey-preview','aria-label':ui.recent},
      h('div',{className:'journal-heading'},h('h2',{className:'eyebrow'},ui.recent),h('span',{className:'journal-count'},String(session?.history.length||0).padStart(2,'0'))),
      session?.history.length?h(Journey,{story,session,short:!story.scenes.find(s=>s.id===sceneId&&(s.death||s.ending))}):h('p',{className:'journal-empty'},ui.empty),
      h('button',{type:'button',className:'btn btn-small journal-open',onClick:openLog},ui.show));
    const button=h('button',{type:'button',className:'btn btn-small journal-button','data-action':'journal','aria-haspopup':'dialog',onClick:openLog},ui.log);
    const dialog=h('dialog',{ref:dialogRef,className:'journal-dialog','aria-labelledby':'journal-title',onCancel:(e)=>{e.preventDefault();close()},onClose:()=>setOpen(false),onClick:e=>{if(e.target===dialogRef.current)close()}},
      h('div',{className:'journal-inner'},
        h('header',{className:'journal-header'},h('div',null,h('p',{className:'eyebrow'},ui.version),h('h2',{id:'journal-title'},ui.title)),h('button',{type:'button',className:'btn btn-small',onClick:close,'data-action':'journal-close'},ui.close)),
        h('div',{className:'journal-tabs','role':'group','aria-label':ui.title},
          h('button',{type:'button',className:'btn','aria-pressed':tab==='journey',onClick:()=>setTab('journey')},ui.journey),
          h('button',{type:'button',className:'btn','aria-pressed':tab==='archive',onClick:()=>setTab('archive')},ui.archive)),
        tab==='journey'?h('section',null,h('p',{className:'journal-meta'},format(ui.count,session?.history.length||0)),session?.history.length?h(Journey,{story,session}):h('p',null,ui.empty)):
          h('section',null,h('p',{className:'journal-meta'},format(ui.progress,ids.length)),ids.length?story.scenes.filter(s=>ids.includes(s.id)).map(scene=>h('details',{className:'archive-entry',key:scene.id},h('summary',null,scene.title),h('p',null,scene.text.replaceAll('{callsign}',callsign||'MICA')))):h('p',null,ui.archiveEmpty)),
        h('label',{className:'effects-setting'},h('span',null,ui.motion),h('input',{type:'checkbox',checked:effects,onChange:e=>setEffects(e.target.checked)}),h('span',null,effects?ui.motionOn:ui.motionOff))));
    return {summary,button,dialog,ui,open};
  }
  // Fade in as a whole passage: no character-by-character DOM churn or screen-reader noise.
  function Passage({children,lang,sceneId}) {
    const ref=useRef(null);
    const [revealing,setRevealing]=useState(false);
    useLayoutEffect(()=>{
      const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.visuals==='off';
      setRevealing(!reduce);
      const timer=setTimeout(()=>setRevealing(false),700);
      return()=>clearTimeout(timer);
    },[sceneId]);
    const ui=extras[lang]||extras.en;
    return h('div',{className:'passage-wrap'},
      revealing&&h('button',{type:'button',className:'btn btn-small reveal-passage',onClick:()=>setRevealing(false)},ui.reveal),
      h('div',{ref,className:'passage-reveal'+(revealing?' is-revealing':''),onClick:()=>setRevealing(false)},children));
  }
  return {useExpedition,Passage};
}
