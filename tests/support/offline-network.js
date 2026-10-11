import {test as base,expect} from '@playwright/test'
// Page-specific Supabase routes fulfill synthetic responses. Any unmocked external
// request is rejected at context level, before it can reach production.
export const test=base.extend({context:async({context},runFixture)=>{
 await context.route('**/*',route=>{const host=new URL(route.request().url()).hostname;return ['127.0.0.1','localhost'].includes(host)?route.continue():route.abort('blockedbyclient')})
 await runFixture(context)
}})
export {expect}
