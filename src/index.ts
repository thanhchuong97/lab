require('dotenv').config();

import 'reflect-metadata';
import 'module-alias/register';
import 'express-async-errors';
import './app/require';

import * as bodyParser from 'body-parser';

import { createConnection, getConnectionOptions, getManager, getRepository } from 'typeorm';

import { CustomLogger } from './CustomLogger';
import { RootRoute } from '$helpers/decorator';
import cors from 'cors';
import { createServer } from 'http';
import express from 'express';
import { handleError } from '$middlewares/handleError';
import helmet from 'helmet';
import log from '$helpers/log';
import logRequest from '$middlewares/logRequest';
import User from '$entities/User';
import { hash } from 'bcryptjs';
import { AccountStatus, ROLE } from '$enums/index';
import config from '$config';
import socketManager from '$helpers/socket';

const logger = log('Index');
const app = express();
const http = createServer(app);

getConnectionOptions()
  .then((connectionOptions) => {
    return createConnection(
      Object.assign(connectionOptions, {
        logger: process.env.ENVIRONMENT === 'production' ? new CustomLogger() : undefined,
      })
    );
  })
  .then(async () => {
    app.use(bodyParser.json({ limit: '10mb' }));
    app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
    app.use(cors());
    app.use(helmet());
    app.use(logRequest);
    app.use(express.static('public'));

    app.use(RootRoute);

    app.use(handleError);

    // Disable ONLY_FULL_GROUP_BY
    await getManager().query(
      `SET GLOBAL sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''));`
    );

    if (process.env.SERVER_TYPE === 'full') {
      
    }
  
    const userRepository = getRepository(User);

    const admin = await userRepository.findOne({ email: "anphuc.admin@gmail.com" });
    if (!admin) {
      const password = await hash("123456", config.auth.SaltRounds);

      const admin = new User();
      admin.id = 1;
      admin.birthday = new Date();
      admin.email = "anphuc.admin@gmail.com";
      admin.role = ROLE.ADMIN;
      admin.phoneNumber = "0927633733";
      admin.gender = 1;
      admin.fullName = "anphuc";
      admin.password = password;
      admin.status = AccountStatus.ACTIVE;
      await userRepository.save(admin);
    }

    http.listen(process.env.SERVER_PORT, () => {
      logger.info(
        `Express server started on port ${process.env.SERVER_PORT}. ENV: ${process.env.ENVIRONMENT}`
      );
    });
    socketManager.init(http);
  })
  .catch((error) => logger.error(error));