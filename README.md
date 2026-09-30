# Lend & Loop

Lend & Loop is a campus resource-sharing platform built as a full-stack prototype. It keeps the original frontend UI and integrates it with a Flask backend, database persistence, auth, booking flows, verification, and demand-prediction logic.

## Project goal

The app helps students and campus communities lend, borrow, and discover useful resources such as equipment, study rooms, books, and specialist skills without rebuilding the original frontend from scratch.

## Files created

- backend/app.py
- backend/config.py
- backend/database.py
- backend/models.py
- backend/__init__.py
- backend/routes/auth.py
- backend/routes/resources.py
- backend/routes/bookings.py
- backend/routes/verification.py
- backend/routes/admin.py
- backend/routes/notifications.py
- backend/routes/reviews.py
- backend/services/matching.py
- backend/services/notifications.py
- backend/services/predictions.py
- backend/ml/demand_prediction.py
- .env
- .env.example
- README.md

## Files modified

- index.html
- style.css
- script.js

## Tech stack

- Python 3
- Flask
- Flask-SQLAlchemy
- Flask-JWT-Extended
- SQLite for local development
- MySQL-ready environment config
- JavaScript frontend with original HTML/CSS preserved

## Database setup

1. Create a virtual environment:
   ```bash
   python -m venv .venv
   ```
2. Activate it:
   ```bash
   .\.venv\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment template:
   ```bash
   copy .env.example .env
   ```
5. Update values in `.env` as needed:
   ```env
   SECRET_KEY=your_secret_key
   DATABASE_URL=sqlite:///lendandloop.db
   ```
6. Initialize the database:
   ```bash
   python -c "from backend.app import create_app; app = create_app(); app.app_context().push(); from backend.database import db; db.create_all(); print('DB ready')"
   ```

## Backend installation commands

```bash
cd "c:\Users\Yashmitha\Downloads\LendandLoop-main\LendandLoop-main"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

## How to run the complete project

### Start the backend

```bash
python backend/app.py
```

### Open the app

Visit:

```text
http://127.0.0.1:5000
```

## Test login credentials

### Student
- Email: `student@campus.edu`
- Password: `student123`

### Admin
- Email: `admin@campus.edu`
- Password: `admin123`

## API endpoint list

### Authentication
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Resources
- `GET /api/resources`
- `POST /api/resources`
- `DELETE /api/resources/<id>`
- `POST /api/resources/<id>/activate`

### Bookings
- `GET /api/bookings/my`
- `POST /api/bookings`
- `POST /api/bookings/<id>/return`

### Verification
- `POST /api/verification/submit`
- `GET /api/verification/queue`
- `POST /api/verification/<id>/approve`
- `POST /api/verification/<id>/reject`

### Admin
- `GET /api/admin/analytics`
- `GET /api/admin/verification-queue`

### Notifications
- `GET /api/notifications`

### Predictions
- `GET /api/predictions`
- `GET /api/supply-gaps`

## ML implementation explanation

This project includes a prototype predictive engine rather than an advanced production ML pipeline.

### How it works
- A synthetic demand history is generated for common campus resources.
- The logic compares predicted demand against current supply.
- It estimates shortage risk and highlights idle resources that could be activated.
- This is shown in the dashboard cards, prediction panels, and smart alerts.

### Why this is a prototype
- It uses realistic mock data rather than a trained model.
- It is designed for a hackathon or product demo.
- It demonstrates demand forecasting behavior without needing external ML infrastructure.

### Use case
- Highlight items likely to be in short supply next week
- Suggest when an idle projector, DSLR, or kit should be activated
- Help owners and admins make smarter lending decisions

## Notes

- The original frontend design has been preserved and connected to the backend.
- LocalStorage was replaced with API-backed data wherever appropriate.
- The app is ready for local demo use and can be extended into a real production system later.
