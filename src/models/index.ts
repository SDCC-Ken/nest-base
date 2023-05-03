import { Sequelize } from 'sequelize'

import { Person } from 'models/person'

export const MainDatabaseModel = [
  Person,
]

export async function extraFunction(sequelize: Sequelize) {}
