import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:'reserved-selection.spec.js',workers:1,use:{baseURL:'http://127.0.0.1:5219',channel:'chrome',headless:true},outputDir:'test-results-reserved',reporter:'list'})
