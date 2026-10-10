export const adminCity = {
  appName: import.meta.env.VITE_APP_NAME || 'Lisboa por Outros',
  cityName: import.meta.env.VITE_CITY_NAME || 'Lisboa',
  englishEnabled: (import.meta.env.VITE_SUPPORTED_LANGUAGES || 'pt,en').split(',').includes('en'),
  readingMode: import.meta.env.VITE_CONTENT_MODE === 'reading'
};
