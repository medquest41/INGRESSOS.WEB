import { defineConfig } from '@playwright/test'
export default defineConfig({
 testDir:'./tests',fullyParallel:false,workers:1,timeout:45000,
 use:{headless:true,channel:process.env.TEST_BROWSER||'chrome',screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[
  {name:'local-dev',testMatch:'**/platform.spec.js',use:{baseURL:process.env.TEST_LOCAL_URL||'http://127.0.0.1:5191'}},
  {name:'supabase-adapter',testMatch:'**/remote.spec.js',use:{baseURL:process.env.TEST_REMOTE_URL||'http://127.0.0.1:5190'}},
 ],
 webServer:[
  {command:'npm run dev:demo -- --host 127.0.0.1 --port 5191 --strictPort',url:'http://127.0.0.1:5191',reuseExistingServer:!process.env.CI,timeout:60000},
  {command:'npm run dev -- --host 127.0.0.1 --port 5190 --strictPort',url:'http://127.0.0.1:5190',reuseExistingServer:!process.env.CI,timeout:60000},
 ],reporter:'list',
})
