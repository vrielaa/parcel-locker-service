import swaggerUi from "swagger-ui-express"

const jsonContent = {
  "application/json": {
    schema: {
      type: "object"
    }
  }
}

const okResponse = {
  description: "Operacja zakonczona powodzeniem",
  content: jsonContent
}

const createdResponse = {
  description: "Zasob utworzony",
  content: jsonContent
}

const errorResponse = {
  description: "Blad requestu lub blad serwera",
  content: {
    "application/json": {
      schema: {
        $ref: "#/components/schemas/ErrorResponse"
      }
    }
  }
}

const authResponses = {
  200: okResponse,
  401: errorResponse,
  403: errorResponse,
  500: errorResponse
}

const idParam = (name, description) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: {
    type: "integer",
    minimum: 1
  }
})

const jsonBody = (schema) => ({
  required: true,
  content: {
    "application/json": {
      schema
    }
  }
})

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Parcel Locker Service API",
    version: "1.0.0",
    description: "REST API dla aplikacji obslugi automatow paczkowych."
  },
  servers: [
    {
      url: "http://localhost:3000/api",
      description: "Lokalny backend"
    },
    {
      url: "/api",
      description: "Ten sam host co frontend"
    }
  ],
  tags: [
    { name: "Public", description: "Publiczne listy miast i automatow" },
    { name: "Auth", description: "Rejestracja, logowanie i konto uzytkownika" },
    { name: "Klient", description: "Operacje klienta" },
    { name: "Paczki", description: "Wspolne operacje na paczkach" },
    { name: "Operator", description: "Panel operatora" },
    { name: "Kurier", description: "Panel kuriera" },
    { name: "Admin", description: "Panel administratora" },
    { name: "DB", description: "Administracja baza danych" }
  ],
  paths: {
    "/miasta": {
      get: {
        tags: ["Public"],
        summary: "Lista miast z automatami",
        responses: {
          200: {
            description: "Lista nazw miast",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          },
          500: errorResponse
        }
      }
    },
    "/automaty": {
      get: {
        tags: ["Public"],
        summary: "Lista automatow w miescie",
        parameters: [
          {
            name: "miasto",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Nazwa miasta"
          }
        ],
        responses: {
          200: {
            description: "Lista automatow",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Automat" }
                }
              }
            }
          },
          500: errorResponse
        }
      }
    },
    "/automaty/{id}": {
      get: {
        tags: ["Public"],
        summary: "Szczegoly automatu i jego skrytek",
        parameters: [idParam("id", "ID automatu")],
        responses: {
          200: {
            description: "Wiersze widoku automatu",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/AutomatViewRow" }
                }
              }
            }
          },
          404: errorResponse,
          500: errorResponse
        }
      }
    },
    "/automaty/{id}/status": {
      put: {
        tags: ["Operator"],
        summary: "Zmiana statusu automatu",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("id", "ID automatu")],
        requestBody: jsonBody({ $ref: "#/components/schemas/AutomatStatusRequest" }),
        responses: authResponses
      }
    },
    "/skrytki/{id}/status": {
      put: {
        tags: ["Operator"],
        summary: "Zmiana statusu skrytki",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("id", "ID skrytki")],
        requestBody: jsonBody({ $ref: "#/components/schemas/SkrytkaStatusRequest" }),
        responses: authResponses
      }
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Rejestracja klienta",
        requestBody: jsonBody({ $ref: "#/components/schemas/RegisterRequest" }),
        responses: {
          200: {
            description: "Token JWT i rola",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" }
              }
            }
          },
          400: errorResponse,
          409: errorResponse,
          500: errorResponse
        }
      }
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Logowanie",
        requestBody: jsonBody({ $ref: "#/components/schemas/LoginRequest" }),
        responses: {
          200: {
            description: "Token JWT i rola",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" }
              }
            }
          },
          401: errorResponse,
          500: errorResponse
        }
      }
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Dane zalogowanego uzytkownika",
        security: [{ bearerAuth: [] }],
        responses: authResponses
      }
    },
    "/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Zmiana hasla",
        security: [{ bearerAuth: [] }],
        requestBody: jsonBody({ $ref: "#/components/schemas/ChangePasswordRequest" }),
        responses: authResponses
      }
    },
    "/me/paczki": {
      get: {
        tags: ["Klient"],
        summary: "Paczki zalogowanego klienta",
        security: [{ bearerAuth: [] }],
        responses: authResponses
      },
      post: {
        tags: ["Klient"],
        summary: "Nadanie paczki przez klienta",
        security: [{ bearerAuth: [] }],
        requestBody: jsonBody({ $ref: "#/components/schemas/ClientCreatePackageRequest" }),
        responses: {
          201: createdResponse,
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          500: errorResponse
        }
      }
    },
    "/paczki": {
      post: {
        tags: ["Paczki"],
        summary: "Utworzenie paczki przez operatora",
        security: [{ bearerAuth: [] }],
        requestBody: jsonBody({ $ref: "#/components/schemas/OperatorCreatePackageRequest" }),
        responses: authResponses
      }
    },
    "/paczki/{id}/zdarzenia": {
      get: {
        tags: ["Paczki"],
        summary: "Historia zdarzen paczki",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("id", "ID paczki")],
        responses: authResponses
      }
    },
    "/paczki/{id}/przedluzenia": {
      post: {
        tags: ["Paczki"],
        summary: "Przedluzenie terminu odbioru paczki",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("id", "ID paczki")],
        requestBody: jsonBody({ $ref: "#/components/schemas/ExtendPickupRequest" }),
        responses: authResponses
      }
    },
    "/operator/paczki/pending": {
      get: {
        tags: ["Operator"],
        summary: "Paczki oczekujace na zatwierdzenie",
        security: [{ bearerAuth: [] }],
        responses: authResponses
      }
    },
    "/operator/paczki/{id}/skrytki": {
      get: {
        tags: ["Operator"],
        summary: "Wolne skrytki pasujace do paczki",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("id", "ID paczki")],
        responses: authResponses
      }
    },
    "/operator/paczki/{id}/approve": {
      post: {
        tags: ["Operator"],
        summary: "Zatwierdzenie paczki",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("id", "ID paczki")],
        responses: authResponses
      }
    },
    "/kurier/paczki/pool": {
      get: {
        tags: ["Kurier"],
        summary: "Pula paczek do podjecia",
        security: [{ bearerAuth: [] }],
        responses: authResponses
      }
    },
    "/kurier/paczki": {
      get: {
        tags: ["Kurier"],
        summary: "Paczki przypisane do kuriera",
        security: [{ bearerAuth: [] }],
        responses: authResponses
      }
    },
    "/kurier/paczki/{id}/podejmij": {
      post: {
        tags: ["Kurier"],
        summary: "Rozpoczecie transportu paczki",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("id", "ID paczki")],
        responses: authResponses
      }
    },
    "/kurier/paczki/{id}/skrytki-docelowe": {
      get: {
        tags: ["Kurier"],
        summary: "Wolne skrytki w automacie docelowym",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("id", "ID paczki")],
        responses: authResponses
      }
    },
    "/kurier/paczki/{id}/umiesc-w-automacie": {
      post: {
        tags: ["Kurier"],
        summary: "Umieszczenie paczki w skrytce",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("id", "ID paczki")],
        requestBody: jsonBody({ $ref: "#/components/schemas/PlaceInLockerRequest" }),
        responses: authResponses
      }
    },
    "/kurier/skrytki/{id}/status": {
      put: {
        tags: ["Kurier"],
        summary: "Oznaczenie skrytki jako uszkodzonej",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("id", "ID skrytki")],
        responses: authResponses
      }
    },
    "/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "Lista uzytkownikow",
        security: [{ bearerAuth: [] }],
        responses: authResponses
      },
      post: {
        tags: ["Admin"],
        summary: "Dodanie uzytkownika",
        security: [{ bearerAuth: [] }],
        requestBody: jsonBody({ $ref: "#/components/schemas/CreateUserRequest" }),
        responses: {
          201: createdResponse,
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          409: errorResponse,
          500: errorResponse
        }
      }
    },
    "/admin/users/{id}": {
      delete: {
        tags: ["Admin"],
        summary: "Usuniecie uzytkownika",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("id", "ID AppUser")],
        responses: authResponses
      }
    },
    "/admin/clients/{id}/paczki": {
      get: {
        tags: ["Admin"],
        summary: "Paczki klienta",
        security: [{ bearerAuth: [] }],
        parameters: [
          idParam("id", "ID klienta"),
          {
            name: "mode",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["sent", "received"], default: "sent" }
          }
        ],
        responses: authResponses
      }
    },
    "/admin/paczki/{id}/simulate-pickup": {
      post: {
        tags: ["Admin"],
        summary: "Symulacja odbioru paczki",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("id", "ID paczki")],
        responses: authResponses
      }
    },
    "/admin/automaty": {
      post: {
        tags: ["Admin"],
        summary: "Dodanie automatu",
        security: [{ bearerAuth: [] }],
        requestBody: jsonBody({ $ref: "#/components/schemas/CreateAutomatRequest" }),
        responses: {
          201: createdResponse,
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          409: errorResponse,
          500: errorResponse
        }
      }
    },
    "/admin/automaty/{id}": {
      delete: {
        tags: ["Admin"],
        summary: "Usuniecie automatu",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("id", "ID automatu")],
        responses: authResponses
      }
    },
    "/admin/automaty/locker-faulty": {
      get: {
        tags: ["Admin"],
        summary: "Automaty z uszkodzonymi skrytkami",
        security: [{ bearerAuth: [] }],
        responses: authResponses
      }
    },
    "/admin/automaty/{parcelLockerId}/lockers/{lockerId}/mark-repaired": {
      put: {
        tags: ["Admin"],
        summary: "Oznaczenie skrytki jako naprawionej",
        security: [{ bearerAuth: [] }],
        parameters: [
          idParam("parcelLockerId", "ID automatu"),
          idParam("lockerId", "ID skrytki")
        ],
        responses: authResponses
      }
    },
    "/db/test": {
      get: {
        tags: ["DB"],
        summary: "Test polaczenia z baza",
        security: [{ bearerAuth: [] }],
        responses: authResponses
      }
    },
    "/db/init": {
      post: {
        tags: ["DB"],
        summary: "Inicjalizacja schematu parcel_locker",
        security: [{ bearerAuth: [] }],
        responses: authResponses
      }
    },
    "/db/clear": {
      post: {
        tags: ["DB"],
        summary: "Usuniecie schematu parcel_locker",
        security: [{ bearerAuth: [] }],
        responses: authResponses
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: false },
          error: { type: "string" },
          message: { type: "string" }
        }
      },
      AuthResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          token: { type: "string" },
          rola: { $ref: "#/components/schemas/Role" },
          must_change_password: { type: "boolean" }
        }
      },
      Role: {
        type: "string",
        enum: ["ADMIN", "OPERATOR", "KURIER", "KLIENT"]
      },
      RegisterRequest: {
        type: "object",
        required: ["imie", "nazwisko", "email", "password", "password2"],
        properties: {
          imie: { type: "string", example: "Jan" },
          nazwisko: { type: "string", example: "Kowalski" },
          email: { type: "string", format: "email", example: "jan@example.com" },
          telefon: { type: "string", nullable: true },
          password: { type: "string", format: "password", minLength: 8 },
          password2: { type: "string", format: "password", minLength: 8 }
        }
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "admin@test.pl" },
          password: { type: "string", format: "password", example: "admin123" }
        }
      },
      ChangePasswordRequest: {
        type: "object",
        required: ["current_password", "new_password"],
        properties: {
          current_password: { type: "string", format: "password" },
          new_password: { type: "string", format: "password", minLength: 8 }
        }
      },
      ClientCreatePackageRequest: {
        type: "object",
        required: ["automat_id", "szerokosc_cm", "wysokosc_cm", "glebokosc_cm", "odbiorca_email"],
        properties: {
          automat_id: { type: "integer", example: 1 },
          szerokosc_cm: { type: "number", example: 20 },
          wysokosc_cm: { type: "number", example: 10 },
          glebokosc_cm: { type: "number", example: 30 },
          odbiorca_email: { type: "string", format: "email", example: "odbiorca@example.com" },
          odbiorca: {
            type: "object",
            properties: {
              email: { type: "string", format: "email" },
              telefon: { type: "string" }
            }
          }
        }
      },
      OperatorCreatePackageRequest: {
        type: "object",
        required: ["numer_tracking", "szerokosc_cm", "wysokosc_cm", "glebokosc_cm", "nadawca_id", "odbiorca_id"],
        properties: {
          numer_tracking: { type: "string", example: "TRK-LOCAL-001" },
          szerokosc_cm: { type: "number", example: 20 },
          wysokosc_cm: { type: "number", example: 10 },
          glebokosc_cm: { type: "number", example: 30 },
          nadawca_id: { type: "integer", example: 1 },
          odbiorca_id: { type: "integer", example: 2 }
        }
      },
      ExtendPickupRequest: {
        type: "object",
        required: ["ile_godzin"],
        properties: {
          ile_godzin: { type: "integer", minimum: 1, example: 24 }
        }
      },
      PlaceInLockerRequest: {
        type: "object",
        required: ["skrytka_id"],
        properties: {
          skrytka_id: { type: "integer", minimum: 1, example: 123 }
        }
      },
      AutomatStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["AKTYWNY", "W_SERWISIE", "NIEAKTYWNY"] }
        }
      },
      SkrytkaStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["WOLNA", "ZAJETA", "USZKODZONA"] }
        }
      },
      CreateUserRequest: {
        type: "object",
        required: ["role", "imie", "nazwisko", "email", "password"],
        properties: {
          role: { $ref: "#/components/schemas/Role" },
          imie: { type: "string" },
          nazwisko: { type: "string" },
          email: { type: "string", format: "email" },
          telefon: { type: "string" },
          password: { type: "string", format: "password", minLength: 8 }
        }
      },
      CreateAutomatRequest: {
        type: "object",
        required: ["kod", "adres", "miasto", "wspolrzedne", "liczbaWierszy", "liczbaKolumn"],
        properties: {
          kod: { type: "string", example: "WAW999" },
          adres: { type: "string", example: "Testowa 1" },
          miasto: { type: "string", example: "Warszawa" },
          wspolrzedne: { type: "string", example: "52.2297,21.0122" },
          liczbaWierszy: { type: "integer", example: 6 },
          liczbaKolumn: { type: "integer", example: 9 }
        }
      },
      Automat: {
        type: "object",
        properties: {
          automat_id: { type: "integer" },
          nazwa: { type: "string" },
          adres: { type: "string" },
          wspolrzedne_gps: { type: "string" },
          status: { type: "string" },
          miasto: { type: "string" }
        }
      },
      AutomatViewRow: {
        type: "object",
        properties: {
          automat_id: { type: "integer" },
          liczba_wierszy: { type: "integer" },
          liczba_kolumn: { type: "integer" },
          skrytka_id: { type: "integer", nullable: true },
          wiersz: { type: "integer", nullable: true },
          kolumna: { type: "integer", nullable: true },
          status: { type: "string", nullable: true },
          rozmiar: { type: "string", nullable: true },
          szerokosc_cm: { type: "integer", nullable: true },
          wysokosc_cm: { type: "integer", nullable: true },
          glebokosc_cm: { type: "integer", nullable: true }
        }
      }
    }
  }
}

export function setupSwagger(app) {
  app.get("/api/openapi.json", (req, res) => {
    res.json(openApiSpec)
  })

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: "Parcel Locker API Docs",
      swaggerOptions: {
        persistAuthorization: true
      }
    })
  )
}
