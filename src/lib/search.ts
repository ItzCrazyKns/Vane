import { getSearchBackend } from './config/serverRegistry';
import { searchSearxng } from './searxng';
import { createWebSearch } from './searchBackend';

export const searchWeb = createWebSearch(getSearchBackend, searchSearxng);
