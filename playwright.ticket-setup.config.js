import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:'ticket-setup.spec.js',workers:1,use:{baseURL:'http://127.0.0.1:5219',channel:'chrome',headless:true},outputDir:'test-results-ticket-setup',reporter:'list'})
