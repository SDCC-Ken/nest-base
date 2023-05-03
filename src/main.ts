import { NestFactory } from '@nestjs/core'
import { Request, Response } from 'express'

import helmet = require('helmet')
import rateLimit = require('express-rate-limit')
import bodyParser = require('body-parser')



import { AppModule } from 'modules/app'

async function bootstrap() {
  console.debug('Server Started.....')


  const app = await NestFactory.create(AppModule)




  // Helmet
  // Helmet can help protect your app from some well-known web vulnerabilities by setting HTTP headers appropriately.
  // Generally, Helmet is just a collection of 12 smaller middleware functions that set security-related HTTP headers.
  // app.use(helmet())

  // Enable CORS
  app.enableCors({
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: true,
    optionsSuccessStatus: 204,
    exposedHeaders: "Authorization"
  })

  // // Rate limiting
  // app.use(rateLimit({
  //   "windowMs": 1800000,
  //   "max": 18000
  // }))

  // Body Parser
  app.use(bodyParser.json({ limit: '50mb' }))
  app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }))



  await app.listen(8080)

  app.getHttpServer().on('error', error => {
    console.error(error, null, 'SERVER')
    process.exit(1)
  })

  app.getHttpServer().on('listening', () => {
    const server = app.getHttpServer()
    const addr = server.address()
    server.setTimeout(300000)
    const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`
    console.log(`Server has been started and listening on ${bind}`, 'SERVER', 'green', true)
  })
}

bootstrap()
