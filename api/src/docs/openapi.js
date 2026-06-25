'use strict';

const config = require('../config/env');

function buildOpenApiSpec() {
  const apiBase = `/api/${config.server.apiVersion}`;

  return {
    openapi: '3.0.3',
    info: {
      title: 'LISSAFI-P API',
      version: '1.0.0',
      description:
        'Documentation OpenAPI du backend LISSAFI-P. ' +
        'Cette spec couvre les endpoints actuellement implémentés : health, auth, operations, products et stock.',
      contact: {
        name: 'LISSAFI-P Backend',
      },
    },
    servers: [
      {
        url: config.server.baseUrl,
        description: 'Base URL applicative',
      },
    ],
    tags: [
      { name: 'Health', description: 'Sante applicative et dependances' },
      { name: 'Auth', description: 'Authentification, OTP et profil utilisateur' },
      { name: 'Operations', description: 'Operations commerciales et syntheses' },
      { name: 'Products', description: 'Catalogue produits' },
      { name: 'Stock', description: 'Mouvements de stock, alertes et valorisation' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        IdParam: {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
        ProductIdParam: {
          name: 'productId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      },
      schemas: {
        SuccessEnvelope: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Succes' },
            data: {},
          },
          required: ['success', 'message'],
        },
        ErrorEnvelope: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Donnees invalides' },
            errors: {
              type: 'array',
              items: { $ref: '#/components/schemas/ValidationError' },
            },
          },
          required: ['success', 'message'],
        },
        ValidationError: {
          type: 'object',
          properties: {
            field: { type: 'string', example: 'phone' },
            message: { type: 'string', example: 'Le numero de telephone est invalide' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Succes' },
            data: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: { type: 'object' },
                },
                pagination: {
                  $ref: '#/components/schemas/PaginationMeta',
                },
              },
              required: ['items', 'pagination'],
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 25 },
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            totalPages: { type: 'integer', example: 2 },
            hasNext: { type: 'boolean', example: true },
            hasPrev: { type: 'boolean', example: false },
          },
          required: ['total', 'page', 'limit', 'totalPages', 'hasNext', 'hasPrev'],
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            phone: { type: 'string', nullable: true, example: '+237699123456' },
            email: { type: 'string', format: 'email', nullable: true },
            activity_type: {
              type: 'string',
              enum: ['COMMERCE_GENERAL', 'MECANIQUE', 'COUTURE', 'COIFFURE', 'ALIMENTATION', 'AGRICULTURE', 'SERVICES', 'AUTRE'],
            },
            boutique_name: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
            work_hours_start: { type: 'string', nullable: true, example: '08:00' },
            work_hours_end: { type: 'string', nullable: true, example: '18:00' },
            plan: { type: 'string', enum: ['FREE', 'PRO'] },
            is_verified: { type: 'boolean' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        TokensPayload: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
          },
          required: ['accessToken', 'refreshToken', 'user'],
        },
        RegisterRequest: {
          type: 'object',
          properties: {
            phone: { type: 'string', example: '+237699123456' },
            email: { type: 'string', format: 'email' },
            activity_type: {
              type: 'string',
              enum: ['COMMERCE_GENERAL', 'MECANIQUE', 'COUTURE', 'COIFFURE', 'ALIMENTATION', 'AGRICULTURE', 'SERVICES', 'AUTRE'],
              default: 'COMMERCE_GENERAL',
            },
            boutique_name: { type: 'string', example: 'Boutique Centrale' },
          },
        },
        RegisterResponseData: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            identifier: { type: 'string', example: '+237699123456' },
          },
        },
        VerifyOtpRequest: {
          type: 'object',
          required: ['identifier', 'token'],
          properties: {
            identifier: { type: 'string', example: '+237699123456' },
            token: { type: 'string', example: '123456' },
          },
        },
        VerifyOtpResponseData: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            requiresPassword: { type: 'boolean', example: true },
          },
        },
        SetPasswordRequest: {
          type: 'object',
          required: ['userId', 'password'],
          properties: {
            userId: { type: 'string', format: 'uuid' },
            password: { type: 'string', pattern: '^\\d{4}$', example: '1234' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['identifier', 'password'],
          properties: {
            identifier: { type: 'string', example: '+237699123456' },
            password: { type: 'string', pattern: '^\\d{4}$', example: '1234' },
          },
        },
        RefreshRequest: {
          type: 'object',
          required: ['refresh_token'],
          properties: {
            refresh_token: { type: 'string' },
          },
        },
        RefreshResponseData: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
          },
          required: ['accessToken'],
        },
        ResendOtpRequest: {
          type: 'object',
          required: ['identifier'],
          properties: {
            identifier: { type: 'string', example: '+237699123456' },
          },
        },
        UpdateProfileRequest: {
          type: 'object',
          properties: {
            boutique_name: { type: 'string' },
            address: { type: 'string' },
            description: { type: 'string' },
            activity_type: {
              type: 'string',
              enum: ['COMMERCE_GENERAL', 'MECANIQUE', 'COUTURE', 'COIFFURE', 'ALIMENTATION', 'AGRICULTURE', 'SERVICES', 'AUTRE'],
            },
            work_hours_start: { type: 'string', example: '08:00' },
            work_hours_end: { type: 'string', example: '18:00' },
          },
        },
        ChangePasswordRequest: {
          type: 'object',
          required: ['current_password', 'new_password'],
          properties: {
            current_password: { type: 'string', pattern: '^\\d{4}$', example: '1234' },
            new_password: { type: 'string', pattern: '^\\d{4}$', example: '5678' },
          },
        },
        Operation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['VENTE', 'ACHAT', 'DEPENSE', 'RECETTE'] },
            amount: { type: 'integer', example: 15000 },
            article_name: { type: 'string', example: 'Savon Omo 1kg' },
            quantity: { type: 'integer', example: 2 },
            description: { type: 'string', nullable: true },
            op_date: { type: 'string', format: 'date' },
            supplier_name: { type: 'string', nullable: true },
            product_id: { type: 'string', format: 'uuid', nullable: true },
            receipt_url: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateOperationRequest: {
          type: 'object',
          required: ['type', 'amount', 'article_name'],
          properties: {
            type: { type: 'string', enum: ['VENTE', 'ACHAT', 'DEPENSE', 'RECETTE'] },
            amount: { type: 'integer', minimum: 1, example: 15000 },
            article_name: { type: 'string', example: 'Tissu bazin 10m' },
            quantity: { type: 'integer', minimum: 1, default: 1 },
            description: { type: 'string', nullable: true },
            op_date: { type: 'string', format: 'date' },
            supplier_name: { type: 'string', nullable: true },
            product_id: { type: 'string', format: 'uuid', nullable: true },
            receipt_url: { type: 'string', format: 'uri', nullable: true },
          },
        },
        UpdateOperationRequest: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['VENTE', 'ACHAT', 'DEPENSE', 'RECETTE'] },
            amount: { type: 'integer', minimum: 1 },
            article_name: { type: 'string' },
            quantity: { type: 'integer', minimum: 1 },
            description: { type: 'string', nullable: true },
            op_date: { type: 'string', format: 'date' },
            supplier_name: { type: 'string', nullable: true },
            product_id: { type: 'string', format: 'uuid', nullable: true },
            receipt_url: { type: 'string', format: 'uri', nullable: true },
          },
        },
        LimitInfo: {
          type: 'object',
          properties: {
            count: { type: 'integer', example: 3 },
            limit: { type: 'integer', example: 30 },
            canCreate: { type: 'boolean', example: true },
            plan: { type: 'string', enum: ['FREE', 'PRO'], example: 'FREE' },
          },
        },
        DailySummary: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
            VENTE: { type: 'integer', example: 20000 },
            ACHAT: { type: 'integer', example: 10000 },
            DEPENSE: { type: 'integer', example: 5000 },
            RECETTE: { type: 'integer', example: 1000 },
            balance: { type: 'integer', example: 6000 },
            total_income: { type: 'integer', example: 21000 },
            total_expense: { type: 'integer', example: 15000 },
          },
        },
        MonthlySummary: {
          type: 'object',
          properties: {
            year: { type: 'integer', example: 2026 },
            month: { type: 'integer', example: 5 },
            totals: {
              type: 'object',
              additionalProperties: { type: 'integer' },
            },
            net_balance: { type: 'integer', example: 85000 },
            operation_count: { type: 'integer', example: 24 },
            daily_breakdown: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date' },
                  total: { type: 'integer', example: 15000 },
                },
              },
            },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Savon Omo 1kg' },
            description: { type: 'string', nullable: true },
            unit: { type: 'string', example: 'PCS' },
            purchase_price: { type: 'integer', nullable: true, example: 900 },
            sale_price: { type: 'integer', nullable: true, example: 1200 },
            stock_qty: { type: 'integer', example: 12 },
            alert_threshold: { type: 'integer', example: 5 },
            is_active: { type: 'boolean', example: true },
            margin_rate: { type: 'number', nullable: true, example: 25.0 },
            stock_value: { type: 'number', nullable: true, example: 10800 },
            is_low_stock: { type: 'boolean', example: false },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateProductRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Savon Omo 1kg' },
            description: { type: 'string', nullable: true },
            unit: { type: 'string', default: 'PCS' },
            purchase_price: { type: 'integer', nullable: true, minimum: 0 },
            sale_price: { type: 'integer', nullable: true, minimum: 0 },
            stock_qty: { type: 'integer', minimum: 0, default: 0 },
            alert_threshold: { type: 'integer', minimum: 0, default: 5 },
          },
        },
        UpdateProductRequest: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            unit: { type: 'string' },
            purchase_price: { type: 'integer', nullable: true, minimum: 0 },
            sale_price: { type: 'integer', nullable: true, minimum: 0 },
            alert_threshold: { type: 'integer', minimum: 0 },
          },
        },
        StockMovement: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            product_id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            movement_type: { type: 'string', enum: ['ENTREE', 'SORTIE', 'AJUSTEMENT'] },
            quantity: { type: 'integer', example: 10 },
            stock_after: { type: 'number', example: 15 },
            reason: { type: 'string', nullable: true },
            product_name: { type: 'string', nullable: true },
            product_unit: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateStockMovementRequest: {
          type: 'object',
          required: ['product_id', 'movement_type', 'quantity'],
          properties: {
            product_id: { type: 'string', format: 'uuid' },
            movement_type: { type: 'string', enum: ['ENTREE', 'SORTIE', 'AJUSTEMENT'] },
            quantity: { type: 'integer', minimum: 0, example: 10 },
            reason: { type: 'string', nullable: true },
          },
        },
        StockAlertsPayload: {
          type: 'object',
          properties: {
            alerts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  unit: { type: 'string' },
                  stock_qty: { type: 'number' },
                  alert_threshold: { type: 'number' },
                  sale_price: { type: 'number', nullable: true },
                  stock_deficit: { type: 'number' },
                },
              },
            },
            count: { type: 'integer', example: 2 },
          },
        },
        StockValuation: {
          type: 'object',
          properties: {
            product_count: { type: 'integer', example: 8 },
            total_units: { type: 'integer', example: 126 },
            total_purchase_value: { type: 'integer', example: 240000 },
            total_sale_value: { type: 'integer', example: 300000 },
            alert_count: { type: 'integer', example: 2 },
            top_products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  unit: { type: 'string' },
                  stock_qty: { type: 'number' },
                  purchase_price: { type: 'number', nullable: true },
                  sale_price: { type: 'number', nullable: true },
                  purchase_value: { type: 'number', nullable: true },
                  sale_value: { type: 'number', nullable: true },
                },
              },
            },
            computed_at: { type: 'string', format: 'date-time' },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            app: { type: 'string', example: 'ok' },
            db: {
              type: 'object',
              additionalProperties: true,
            },
            redis: {
              type: 'object',
              additionalProperties: true,
            },
            uptime: { type: 'number', example: 123.45 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Requete invalide',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
            },
          },
        },
        Unauthorized: {
          description: 'Authentification requise',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
            },
          },
        },
        NotFound: {
          description: 'Ressource introuvable',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
            },
          },
        },
        Conflict: {
          description: 'Conflit de donnees',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
            },
          },
        },
        TooManyRequests: {
          description: 'Quota ou rate limit atteint',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
            },
          },
        },
        ServerError: {
          description: 'Erreur interne',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
            },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Etat de sante de l application',
          responses: {
            200: {
              description: 'Application et dependances OK',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' },
                },
              },
            },
            503: {
              description: 'Application ou dependances indisponibles',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' },
                },
              },
            },
          },
        },
      },
      [`${apiBase}/auth/register`]: {
        post: {
          tags: ['Auth'],
          summary: 'Creer un compte et envoyer un OTP',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterRequest' },
              },
            },
          },
          responses: {
            201: {
              description: 'Compte cree',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/RegisterResponseData' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            409: { $ref: '#/components/responses/Conflict' },
            429: { $ref: '#/components/responses/TooManyRequests' },
          },
        },
      },
      [`${apiBase}/auth/verify-otp`]: {
        post: {
          tags: ['Auth'],
          summary: 'Verifier le code OTP',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/VerifyOtpRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'OTP verifie',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/VerifyOtpResponseData' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/NotFound' },
            429: { $ref: '#/components/responses/TooManyRequests' },
          },
        },
      },
      [`${apiBase}/auth/set-password`]: {
        post: {
          tags: ['Auth'],
          summary: 'Definir le mot de passe initial',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SetPasswordRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Mot de passe defini et session ouverte',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/TokensPayload' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      [`${apiBase}/auth/login`]: {
        post: {
          tags: ['Auth'],
          summary: 'Se connecter',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Connexion reussie',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/TokensPayload' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            429: { $ref: '#/components/responses/TooManyRequests' },
          },
        },
      },
      [`${apiBase}/auth/refresh`]: {
        post: {
          tags: ['Auth'],
          summary: 'Renouveler l access token',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RefreshRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Access token renouvelle',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/RefreshResponseData' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      [`${apiBase}/auth/resend-otp`]: {
        post: {
          tags: ['Auth'],
          summary: 'Renvoyer un OTP',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ResendOtpRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Reponse neutre de securite',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            429: { $ref: '#/components/responses/TooManyRequests' },
          },
        },
      },
      [`${apiBase}/auth/logout`]: {
        post: {
          tags: ['Auth'],
          summary: 'Se deconnecter',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RefreshRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Deconnexion reussie',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      [`${apiBase}/auth/me`]: {
        get: {
          tags: ['Auth'],
          summary: 'Recuperer le profil courant',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Profil utilisateur',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      {
                        properties: {
                          data: {
                            type: 'object',
                            properties: {
                              user: { $ref: '#/components/schemas/User' },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
        patch: {
          tags: ['Auth'],
          summary: 'Mettre a jour le profil',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateProfileRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Profil mis a jour',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      {
                        properties: {
                          data: {
                            type: 'object',
                            properties: {
                              user: { $ref: '#/components/schemas/User' },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      [`${apiBase}/auth/me/password`]: {
        patch: {
          tags: ['Auth'],
          summary: 'Changer le mot de passe',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChangePasswordRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Mot de passe modifie',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      [`${apiBase}/operations/limits`]: {
        get: {
          tags: ['Operations'],
          summary: 'Recuperer le quota mensuel d operations',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Quota courant',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      { properties: { data: { $ref: '#/components/schemas/LimitInfo' } } },
                    ],
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      [`${apiBase}/operations/summary/daily`]: {
        get: {
          tags: ['Operations'],
          summary: 'Recuperer le resume journalier',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'date',
              in: 'query',
              schema: { type: 'string', format: 'date' },
            },
          ],
          responses: {
            200: {
              description: 'Resume journalier',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      { properties: { data: { $ref: '#/components/schemas/DailySummary' } } },
                    ],
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      [`${apiBase}/operations/summary/monthly`]: {
        get: {
          tags: ['Operations'],
          summary: 'Recuperer le resume mensuel',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'year', in: 'query', schema: { type: 'integer', minimum: 2020, maximum: 2100 } },
            { name: 'month', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } },
          ],
          responses: {
            200: {
              description: 'Resume mensuel',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      { properties: { data: { $ref: '#/components/schemas/MonthlySummary' } } },
                    ],
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      [`${apiBase}/operations`]: {
        get: {
          tags: ['Operations'],
          summary: 'Lister les operations',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['VENTE', 'ACHAT', 'DEPENSE', 'RECETTE'] } },
            { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'date_to', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'amount_min', in: 'query', schema: { type: 'integer', minimum: 0 } },
            { name: 'amount_max', in: 'query', schema: { type: 'integer', minimum: 0 } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'sort_by', in: 'query', schema: { type: 'string', enum: ['op_date', 'amount', 'created_at'] } },
            { name: 'sort_dir', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'] } },
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
          ],
          responses: {
            200: {
              description: 'Liste paginee',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaginatedResponse' },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
        post: {
          tags: ['Operations'],
          summary: 'Creer une operation',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateOperationRequest' },
              },
            },
          },
          responses: {
            201: {
              description: 'Operation creee',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      { properties: { data: { $ref: '#/components/schemas/Operation' } } },
                    ],
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            429: { $ref: '#/components/responses/TooManyRequests' },
          },
        },
      },
      [`${apiBase}/operations/{id}`]: {
        get: {
          tags: ['Operations'],
          summary: 'Recuperer une operation',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            200: {
              description: 'Operation detaillee',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      { properties: { data: { $ref: '#/components/schemas/Operation' } } },
                    ],
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
        put: {
          tags: ['Operations'],
          summary: 'Modifier une operation',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateOperationRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Operation mise a jour',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      { properties: { data: { $ref: '#/components/schemas/Operation' } } },
                    ],
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['Operations'],
          summary: 'Supprimer une operation',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            204: { description: 'Operation supprimee' },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      [`${apiBase}/products/limits`]: {
        get: {
          tags: ['Products'],
          summary: 'Recuperer le quota produits',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Quota produits',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      { properties: { data: { $ref: '#/components/schemas/LimitInfo' } } },
                    ],
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      [`${apiBase}/products`]: {
        get: {
          tags: ['Products'],
          summary: 'Lister le catalogue produits',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'low_stock_only', in: 'query', schema: { type: 'boolean', default: false } },
            { name: 'sort_by', in: 'query', schema: { type: 'string', enum: ['name', 'stock_qty', 'sale_price', 'created_at'] } },
            { name: 'sort_dir', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'] } },
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
          ],
          responses: {
            200: {
              description: 'Catalogue pagine',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaginatedResponse' },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
        post: {
          tags: ['Products'],
          summary: 'Creer un produit',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateProductRequest' },
              },
            },
          },
          responses: {
            201: {
              description: 'Produit cree',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      { properties: { data: { $ref: '#/components/schemas/Product' } } },
                    ],
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            429: { $ref: '#/components/responses/TooManyRequests' },
          },
        },
      },
      [`${apiBase}/products/{id}`]: {
        get: {
          tags: ['Products'],
          summary: 'Recuperer un produit',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            200: {
              description: 'Produit detaille',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      { properties: { data: { $ref: '#/components/schemas/Product' } } },
                    ],
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
        put: {
          tags: ['Products'],
          summary: 'Modifier un produit',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateProductRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Produit mis a jour',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      { properties: { data: { $ref: '#/components/schemas/Product' } } },
                    ],
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['Products'],
          summary: 'Desactiver un produit',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            204: { description: 'Produit desactive' },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      [`${apiBase}/stock/movement`]: {
        post: {
          tags: ['Stock'],
          summary: 'Creer un mouvement de stock',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateStockMovementRequest' },
              },
            },
          },
          responses: {
            201: {
              description: 'Mouvement enregistre',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      { properties: { data: { $ref: '#/components/schemas/StockMovement' } } },
                    ],
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      [`${apiBase}/stock/alerts`]: {
        get: {
          tags: ['Stock'],
          summary: 'Lister les alertes de stock',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Alertes de stock',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      { properties: { data: { $ref: '#/components/schemas/StockAlertsPayload' } } },
                    ],
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      [`${apiBase}/stock/valuation`]: {
        get: {
          tags: ['Stock'],
          summary: 'Recuperer la valorisation du stock',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Valorisation totale',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessEnvelope' },
                      { properties: { data: { $ref: '#/components/schemas/StockValuation' } } },
                    ],
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      [`${apiBase}/stock/movements/{productId}`]: {
        get: {
          tags: ['Stock'],
          summary: 'Lister l historique de stock d un produit',
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: '#/components/parameters/ProductIdParam' },
            {
              name: 'movement_type',
              in: 'query',
              schema: { type: 'string', enum: ['ENTREE', 'SORTIE', 'AJUSTEMENT'] },
            },
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
          ],
          responses: {
            200: {
              description: 'Historique pagine',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaginatedResponse' },
                },
              },
            },
            400: { $ref: '#/components/responses/BadRequest' },
            401: { $ref: '#/components/responses/Unauthorized' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
      },
    },
  };
}

module.exports = {
  buildOpenApiSpec,
};
