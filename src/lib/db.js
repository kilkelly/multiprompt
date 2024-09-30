import Dexie from 'dexie';

export const db = new Dexie('multiprompt');
db.version(1).stores({
  prompts: '++id, timestamp, prompt, modelType, modelReplies',
});