import os
from dotenv import load_dotenv

load_dotenv()

TMDB_API_KEY = os.getenv('TMDB_API_KEY', 'YOUR_TMDB_API_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'YOUR_GEMINI_API_KEY')
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')