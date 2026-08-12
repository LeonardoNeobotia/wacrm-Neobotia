import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  // Forzar español como único idioma según el requerimiento del usuario
  const locale = 'es';

  let messages;
  try {
    messages = (await import(`../../messages/es.json`)).default;
  } catch (error) {
    messages = (await import(`../../messages/en.json`)).default;
  }

  return {
    locale,
    messages
  };
});
