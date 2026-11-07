import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:'scheduled-release.spec.js',workers:1,use:{baseURL:'http://127.0.0.1:5224',channel:'chrome',headless:true},outputDir:'test-results-scheduled-release',reporter:'list'})
