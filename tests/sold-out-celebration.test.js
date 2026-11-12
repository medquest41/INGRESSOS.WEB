import test from 'node:test';
import assert from 'node:assert/strict';
import {soldOutCelebration} from '../src/utils/soldOutCelebration.js';
import {publicTicketOptions} from '../src/utils/ticketPresentation.js';
const ticket={id:'one',highlight:'soldout',remaining:0,available:10,soldOutDays:'3'};
test('esgotado apresenta os dias editáveis e aceita retirar o prazo',()=>{assert.equal(soldOutCelebration({},ticket).daysLabel,'Esgotado em 3 dias');assert.equal(soldOutCelebration({},{...ticket,soldOutDays:'1'}).daysLabel,'Esgotado em 1 dia');assert.equal(soldOutCelebration({},{...ticket,soldOutDays:''}).daysLabel,'');});
test('não comemora estoque disponível, abertura futura ou prazo inválido',()=>{assert.equal(soldOutCelebration({},{...ticket,remaining:1}),null);assert.equal(soldOutCelebration({},{...ticket,startsAt:'2099-01-01'}),null);assert.equal(soldOutCelebration({},ticket,Date.now(),{}),null);assert.equal(soldOutCelebration({},{...ticket,soldOutDays:-3}).daysLabel,'');});
test('a opção é preservada no catálogo sem mudar estoque nem preço',()=>{const t={...ticket,price:25};const result=publicTicketOptions({ticketTypes:[t]})[0];assert.equal(result.highlight,'soldout');assert.equal(result.soldOutDays,'3');assert.equal(result.price,25);assert.equal(t.remaining,0);});
