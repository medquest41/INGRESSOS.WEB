import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:['numbered-tables.spec.js'],workers:1,use:{baseURL:'http://127.0.0.1:5220',channel:'chrome',headless:true},outputDir:'test-results-numbered-tables',reporter:'list'})
