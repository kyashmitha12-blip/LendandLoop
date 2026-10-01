# Lend & Loop — Predictive Resource Activation

A cloud-ready intelligent campus resource-sharing platform where verified college students can list under-used resources and other students can discover, book and borrow them.

## Core Innovation

```
PREDICT → DETECT GAP → FIND IDLE RESOURCE → ACTIVATE OWNER → SMART MATCH → BOOK → RETURN → LEARN
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML · CSS · JavaScript (existing UI preserved) |
| Backend | Python 3 · Flask |
| Database | SQLite (local) / MySQL-ready via `DATABASE_URL` env var |
| ML | Weighted Moving Average + Linear Trend + Seasonal Boost (no external ML libraries needed) |
| Auth | JWT (PyJWT) + bcrypt password hashing (Werkzeug) |
| Storage | Local `backend/uploads/` (structured for cloud migration) |

---

## A. Files Created

```
backend/
  app.py                          Flask app factory + demo data seeder
  config.py                       Environment-variable config
  database.py                     SQLAlchemy db instance
  models.py                       User, Resource, Booking, Verification, Review, Notification, Prediction
  __init__.py
  routes/
    auth_routes.py                POST /api/auth/register|login|logout  GET /api/auth/me
    resource_routes.py            CRUD + /idle + /activate + /matches
    booking_routes.py             POST /api/bookings  GET my|owner  PUT status  POST return
    verification_routes.py        submit|status + admin queue + approve/reject
    review_routes.py              POST /api/reviews  GET /api/users/:id/reviews
    notification_routes.py        GET /api/notifications  PUT read
    prediction_routes.py          GET /api/predictions + /api/supply-gaps
    admin_routes.py               GET /api/admin/analytics|verifications|activations
  services/
    matching_service.py           Weighted match score (availability, condition, distance, price, reliability)
    prediction_service.py         ML-backed prediction + live DB supply count
    idle_resource_service.py      Idle detection (status=idle OR low-utilization + age > 1 day)
    activation_service.py         Suggest idle resources to owners when supply gap detected
  ml/
    demand_prediction.py          WMA + Linear Trend + Seasonal Boost model
  uploads/                        File storage root (resource images, verification docs)
.env                              Local environment config
.env.example                      Template for team members
requirements.txt                  Python dependencies
README.md                         This file
```

## B. Files Modified

```
script.js     Added state.predictions, live /api/predictions fetch, getPredictions() getter,
              updated predictionForResource() / renderPredictions() / renderDashMatches()
              to use live API data instead of hardcoded const.
              Added functools.wraps fix in auth_required decorator.
```

> **Frontend (index.html, style.css) was NOT modified** — the existing UI is fully preserved.

---

## C. Database Setup

The app uses **SQLite by default** — no database installation needed.

The database file is created automatically at startup: `lendandloop.db`

To switch to **MySQL**, set in `.env`:
```env
DATABASE_URL=mysql+pymysql://username:password@localhost:3306/lendandloop
```

---

## D. Backend Installation Commands

```powershell
# 1. Navigate to the project folder
cd "C:\Users\Yashmitha\Downloads\LendandLoop-main\LendandLoop-main"

# 2. Activate the existing virtual environment
.\.venv\Scripts\Activate.ps1

# 3. Install dependencies (already installed in .venv)
pip install -r requirements.txt

# 4. Check .env is present (already set up)
Get-Content .env
```

---

## E. How to Run the Complete Project

```powershell
# Activate venv
.\.venv\Scripts\Activate.ps1

# Start the Flask backend (serves frontend too)
python backend/app.py
```

Open your browser at: **http://127.0.0.1:5000**

The Flask server serves:
- The frontend (`index.html`, `script.js`, `style.css`) at `/`
- All API routes at `/api/...`

No separate frontend server is needed.

---

## F. Test Login Credentials

| Role | Email | Password |
|---|---|---|
| Student | `student@campus.edu` | `student123` |
| Admin | `admin@campus.edu` | `admin123` |

---

## G. API Endpoint List

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register new student |
| POST | `/api/auth/login` | No | Login, returns JWT token |
| GET | `/api/auth/me` | ✅ | Get current user profile |
| POST | `/api/auth/logout` | No | Logout (client clears token) |

### Resources
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/resources` | No | List all resources |
| GET | `/api/resources/idle` | No | List idle/under-utilized resources |
| GET | `/api/resources/:id` | No | Get single resource |
| POST | `/api/resources` | ✅ Verified | Create resource listing |
| PUT | `/api/resources/:id` | ✅ Owner/Admin | Update resource |
| DELETE | `/api/resources/:id` | ✅ Owner/Admin | Delete resource |
| POST | `/api/resources/:id/activate` | ✅ Owner/Admin | Activate idle resource |
| GET | `/api/matches` | No | Smart match scores for available resources |

### Bookings
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/bookings` | ✅ Verified | Book a resource (server-side conflict check) |
| GET | `/api/bookings/my` | ✅ | My bookings as borrower |
| GET | `/api/bookings/owner` | ✅ | Bookings for my resources |
| GET | `/api/bookings/:id` | ✅ | Single booking |
| PUT | `/api/bookings/:id/status` | ✅ Owner/Admin | Update booking status |
| POST | `/api/bookings/:id/return` | ✅ Borrower | Return a booked resource |

### Verification
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/verification/submit` | ✅ | Submit student ID for verification |
| GET | `/api/verification/status` | ✅ | Check your verification status |
| GET | `/api/admin/verifications` | ✅ Admin | View all pending verifications |
| PUT | `/api/admin/verifications/:id` | ✅ Admin | Approve or reject verification |

### Reviews
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/reviews` | ✅ | Post a review after booking |
| GET | `/api/users/:id/reviews` | No | Get reviews for a user |

### Notifications
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/notifications` | ✅ | Get my notifications |
| PUT | `/api/notifications/:id/read` | ✅ | Mark notification as read |

### Predictions & Supply Gaps
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/predictions` | No | ML demand predictions per category |
| GET | `/api/supply-gaps` | No | Supply gap analysis |
| POST | `/api/admin/predictions` | ✅ Admin | Regenerate and save predictions |

### Admin
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/analytics` | ✅ Admin | Platform analytics dashboard data |
| GET | `/api/admin/activations` | ✅ Admin | Idle resources eligible for activation |

---

## H. ML Implementation Explanation

### Model: Weighted Moving Average + Linear Trend + Seasonal Boost

**File:** `backend/ml/demand_prediction.py`

**Inputs (per category):**
- 7 weeks of synthetic historical booking demand
- Recent weeks weighted more heavily (recency bias)

**Method:**
1. **Weighted Moving Average (WMA)** — weights `[1,1,2,2,3,3,4]` give more importance to recent weeks
2. **Linear Trend** — least-squares slope computed over history; capped at ±3 to prevent wild extrapolation
3. **Seasonal Boost** — +15% demand in Oct/Nov and Mar/Apr (Indian academic exam/project seasons)

**Formula:**
```
forecast = WMA(history, weights) + min(3, max(-3, linear_slope)) × seasonal_boost
```

**Example output (October):**
```
Projector    → Predicted demand: 14   Supply: 1   Gap: 13   HIGH
DSLR Camera  → Predicted demand: 10   Supply: 2   Gap: 8    HIGH
Arduino Kit  → Predicted demand: 17   Supply: 1   Gap: 16   HIGH
```

**Data source:** Synthetic training data (clearly labelled as prototype). The service layer (`prediction_service.py`) fetches **real supply counts from the database** so the gap calculation is always live.

**Production upgrade path:**
1. Replace `SYNTHETIC_HISTORY` with a real DB query (booking counts per week per category)
2. Optionally swap the WMA model with scikit-learn `LinearRegression` or a `statsmodels` ARIMA model

---

## Hackathon Demo Flow

1. Login as `student@campus.edu`
2. Dashboard shows: Predicted Shortages · Idle Resources · Opportunities
3. Open **Predictions** → see Projector demand=14, supply=1, gap=13
4. Open **Smart Alerts** → see "Your projector may be needed"
5. Click **Activate Resource** → backend sets `idle → available`
6. Another student searches → Smart Matching shows 96% match
7. Student books → DB records booking, owner notified
8. Student returns → resource `booked → available`
9. New usage data available for next prediction cycle

---

## Notes

- Passwords are stored as bcrypt hashes (Werkzeug) — never plain text
- JWT tokens expire after 7 days
- Double-booking is prevented server-side (date-overlap query)
- Admin role is enforced in backend — frontend role selection is UI-only
- File uploads stored in `backend/uploads/` — code is structured for S3/Firebase migration
- This is a **hackathon prototype** — predictions use synthetic training data

> **CURRENTLY IMPLEMENTED:** Auth, booking, return, verification admin queue, demand prediction, supply gap, idle detection, owner activation, smart matching, notifications, reviews, admin analytics
>
> **FUTURE EXTENSIONS:** Real ML training from live booking history, cloud storage for uploads, email notifications, payment integration, mobile app
