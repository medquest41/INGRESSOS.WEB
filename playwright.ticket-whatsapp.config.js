import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:'ticket-whatsapp.spec.js',workers:1,use:{baseURL:'http://127.0.0.1:5225',channel:'chrome',headless:true},outputDir:'test-results-ticket-whatsapp',reporter:'list'})
