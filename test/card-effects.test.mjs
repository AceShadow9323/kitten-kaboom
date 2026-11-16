import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
import {CARD_EFFECTS,cardEffectMarkup,CARD_EFFECT_CSS} from '../game/card-effects.mjs';
test('live illustrations exactly reuse the approved public preview and never include private card faces',async()=>{
  const source=await readFile(new URL('../previews/cards.html',import.meta.url),'utf8'),start=source.indexOf(' const back='),end=source.indexOf(' function stopAll()',start),context=vm.createContext({});vm.runInContext(source.slice(start,end),context);
  assert.deepEqual(CARD_EFFECTS.map(c=>c.id),['nope','attack','targeted','alter','peek','shuffle','skip','favor','bottom','defuse']);
  for(const card of CARD_EFFECTS){const actual=cardEffectMarkup(card.id),approved=vm.runInContext('markup('+JSON.stringify(card.id)+')',context);assert.equal(actual,approved,card.id);for(const img of actual.matchAll(/<img[^>]+src="([^"]+)"/g))assert.equal(img[1],'/art/back.jpg')}
  assert.ok(!/@keyframes\s+(?!cfx-)/.test(CARD_EFFECT_CSS));assert.ok(!/(?:^|\})body\s*\{/.test(CARD_EFFECT_CSS));
});
