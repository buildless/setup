import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: 'https://5c41fe474b8d80994261103ab94b560d@o4504604187951104.ingest.sentry.io/4506341130698752',
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0
})
