import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:['seating-flow.spec.js','reserved-selection.spec.js','ticket-setup.spec.js'],workers:1,use:{baseURL:'http://127.0.0.1:5219',channel:'chrome',headless:true},outputDir:'test-results-seating',reporter:'list'})
