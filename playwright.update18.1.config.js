import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:'remote.spec.js',workers:1,timeout:45000,use:{channel:'chrome',headless:true,baseURL:'http://127.0.0.1:5299'},webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5299 --strictPort',url:'http://127.0.0.1:5299',timeout:45000},reporter:'list'})
