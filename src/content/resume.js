// Structured facts the 3D scenes render from. The canonical human-readable
// copy lives in index.html (crawlable, JS-free); this file feeds the world.

export const STATS = [
  { value: 6, suffix: '+', label: 'Years in ops' },
  { value: 10, suffix: '+', label: 'Marketplaces' },
  { value: 4, suffix: '', label: 'AI tools shipped' },
  { value: 3, suffix: '', label: 'Awards earned' }
]

export const MARKETPLACES = [
  'AMAZON', 'WALMART', 'SHOPIFY', 'SALSIFY', 'HOME DEPOT',
  "LOWE'S", 'MENARDS', 'HOUZZ', 'ZORO', 'BED BATH', 'ACE'
]

export const ATTRIBUTES = [
  'COLOR', 'SIZE', 'FIT', 'FABRIC', 'BRAND', 'STYLE',
  'PATTERN', 'SLEEVE', 'NECK', 'WASH', 'RISE', 'HEM'
]

export const SKILLS = [
  'Salsify PIM', 'Amazon SC', 'Walmart SC', 'Shopify', 'HD & Lowe\'s',
  'n8n', 'AI Chatbots', 'AI Analysis', 'Excel + VBA', 'PowerPoint',
  'Data Analysis', 'QC / SQC', 'Six Sigma', 'Leadership',
  'Project Mgmt', 'Process Opt', 'GS1 / UPC'
]

export const PROJECTS = [
  { key: 'qc', name: 'QC TRACKER', tag: 'Excel + VBA' },
  { key: 'bot', name: 'AI CHATBOT', tag: 'n8n + Gemini' },
  { key: 'risk', name: 'RETURN RISK', tag: 'Prompt logic' },
  { key: 'pipe', name: 'DATA PIPELINE', tag: 'Automation' }
]

export const MOVES = ['FLIP', 'LEAP', 'KICK', 'SPIN']
