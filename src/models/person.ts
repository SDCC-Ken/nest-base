import { Op, Model, Sequelize, DataTypes, Includeable } from 'sequelize'


export class Person extends Model {
  id: number

  userName: string
  password: string


  firstName: string
  lastName: string
  displayName: string

  identity: string

  photoURL: string

  createdAt: Date
  updatedAt: Date
  deletedAt: Date
  createdBy: string
  updatedBy: string
  deletedBy: string
}

export function generateModel(sequelize: Sequelize) {
  Person.init(
    {
      id: {
        primaryKey: true,
        autoIncrement: true,
        type: DataTypes.BIGINT
      },

      userName: {
        type: DataTypes.STRING(255)
      },
      password: {
        type: DataTypes.STRING(255)
      },

      firstName: {
        type: DataTypes.STRING(255)
      },

      lastName: {
        type: DataTypes.STRING(255)
      },

      displayName: {
        type: DataTypes.STRING(255)
      },

      identity: {
        type: DataTypes.STRING(255)
      },

      photoURL: {
        type: DataTypes.TEXT
      },




      createdAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdBy: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      updatedBy: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      deletedBy: {
        type: DataTypes.STRING(100),
        allowNull: true
      }
    },
    {
      sequelize,
      timestamps: false,
      tableName: 'person',
      indexes: [
        {
          fields: ['userName']
        },
        {
          fields: ['firstName']
        },
        {
          fields: ['lastName']
        },
        {
          fields: ['displayName']
        }
      ]
    }
  )

  return Person
}