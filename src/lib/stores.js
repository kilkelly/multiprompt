import { browser } from '$app/environment'
import { writable } from 'svelte/store'
import { MODEL_TYPE_TEXT } from '$lib/common'
 
const LOCALSTORAGE_MODEL_TYPE = 'multiprompt-model-type'
const LOCALSTORAGE_NUMBER_OF_MODELS = 'multiprompt-number-of-models'
const LOCALSTORAGE_API_KEY = 'multiprompt-nano-gpt-api-key'

// -----

export const storeModelType = writable((browser ? window.localStorage.getItem(LOCALSTORAGE_MODEL_TYPE) ?? MODEL_TYPE_TEXT : MODEL_TYPE_TEXT)) 

storeModelType.subscribe((value) => {
  if (browser) { window.localStorage.setItem(LOCALSTORAGE_MODEL_TYPE, value) }
})

// -----

export const storeNumberOfModels = writable((browser ? window.localStorage.getItem(LOCALSTORAGE_NUMBER_OF_MODELS) ?? 2 : 2)) 

storeNumberOfModels.subscribe((value) => {
  if (browser) { window.localStorage.setItem(LOCALSTORAGE_NUMBER_OF_MODELS, value) }
})

// -----

export const storeAPIKey = writable((browser ? window.localStorage.getItem(LOCALSTORAGE_API_KEY) ?? '' : '')) 

storeAPIKey.subscribe((value) => {
  if (browser) { window.localStorage.setItem(LOCALSTORAGE_API_KEY, value) }
})

// -----

 