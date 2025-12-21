from flask import Flask, render_template, request, jsonify, session
import requests
import os
from config import TMDB_API_KEY, GEMINI_API_KEY, SECRET_KEY
import google.generativeai as genai
from datetime import timedelta
import random
# Imports


# # Environment variables
# load_dotenv()


# Start Flask app
app = Flask(__name__)


# Flask configuration
app.config['SECRET_KEY'] = SECRET_KEY
app.config['SESSION_COOKIE_DURATION'] = timedelta(hours=1)
app.permanent_session_lifetime = timedelta(hours=1)

# Google Generative AI configuration
if GEMINI_API_KEY and GEMINI_API_KEY != "YOUR_GEMINI_API_KEY":
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-flash-lite-latest')
else:
    print("[WARNING] GEMINI_API_KEY not configured. Using fallback recommendations.")
    model = None

# API Base URLs
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_SEARCH_URL = f"{TMDB_BASE_URL}/search/movie"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"


def search_movies(query):
    """
    Search movies from TMDB Api
    """
    # Check if the TMDB API key is set 
    if not TMDB_API_KEY or TMDB_API_KEY == "YOUR_TMDB_API_KEY":
        # Mock data
        return [
            {"id": 1, "title": query, "year": 2024, "poster_path": None},
        ]
    
    try:
        # Request headers with Bearer token authentication
        headers = {
            'Authorization': f'Bearer {TMDB_API_KEY}',
            'accept': 'application/json'
        }
        params = {
            'query': query,
            'language': 'en-US'  
        }
        full_url = TMDB_SEARCH_URL + '?' + '&'.join([f'{k}={v}' for k, v in params.items()])
        print(f"[DEBUG] Requesting: {full_url}")
        print(f"[DEBUG] Headers: {headers}")
        
        response = requests.get(TMDB_SEARCH_URL, headers=headers, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        print(f"[DEBUG] API Response: {data}")
        movies = []
        # Iterate over the first 5 movie results from the API response
        for movie in data.get('results', [])[:5]:  # First 5 results
            release_date = movie.get('release_date', '')
            year = release_date[:4] if release_date else 'N/A'
            rating = movie.get('vote_average', 0)
            
            movies.append({
                'id': movie.get('id'),
                'title': movie.get('title'),
                'year': year,
                'backdrop_path': movie.get('backdrop_path'),
                'overview': movie.get('overview', ''),
                'rating': round(rating, 1)
            })
        
        print(f"[SEARCH] Query: '{query}' -> Found {len(movies)} movies")
        return movies
    
    except requests.RequestException as e:
        print(f"[ERROR] TMDB API Error: {e}")
        return []

# Horizontal movie background 
def get_movie_backdrop(movie_title):
    """
    Search for movie backdrop with the given movie title using TMDB Api
    """
    # Check if the TMDB API key is set 
    if not TMDB_API_KEY or TMDB_API_KEY == "YOUR_TMDB_API_KEY":
        return None
    
    try:
        # Request headers with Bearer token authentication
        headers = {
            'Authorization': f'Bearer {TMDB_API_KEY}',
            'accept': 'application/json'
        }
        params = {
            'query': movie_title,
            'language': 'en-US'
        }
        response = requests.get(TMDB_SEARCH_URL, headers=headers, params=params, timeout=5)
        results = response.json().get('results', [])
        
        if results:
            backdrop_path = results[0].get('backdrop_path')
            print(f"[BACKDROP] Found for '{movie_title}': {backdrop_path}")
            return backdrop_path
        else:
            print(f"[BACKDROP] No results found for '{movie_title}'")
            return None
    except Exception as e:
        print(f"[ERROR] Failed to get backdrop for '{movie_title}': {e}")
        return None


def get_fallback_recommendation(user1_movie, user2_movie):
    """
    Recommendations if Gemini Api fails
    """
    fallback_movies = [
        ("The Shawshank Redemption", "Her iki filmin de karakter derinliği ve duygusal hikaye sunmaktadır."),
        ("Inception", "Harika sinematografi ve düşündürücü senaryo ile bilim kurgu severler için mükemmel."),
        ("The Dark Knight", "İntrikası ve oyunculuğu ile her iki film severini tatmin edecektir."),
        ("Forrest Gump", "Esinlendirici ve duygusal hikaye her zaman tutuluyor."),
        ("Interstellar", "Bilim kurgu ve duygusal derinlik kombinasyonu harika."),
        ("Pulp Fiction", "Yapısı ve karakterleri ile film meraklılarını hoşlandıracaktır."),
        ("The Green Mile", "İnsani değerleri ve derinlik ile dikkat çeker."),
        ("Goodfellas", "Sinematografi ve hikaye anlatımı ile başarılıdır.")
    ]
    
    # Random movie selection since there is not much fallback movie data 
    # For further versions i will upgrade fallback section with more data and reasoning 
    movie, reason = random.choice(fallback_movies)
    
    print(f"[FALLBACK] User1: {user1_movie}, User2: {user2_movie} -> Recommended: {movie}")
    
    return {
        "movie": movie,
        "reason": reason
    }


def movie_exists_in_tmdb(movie_title):
    """
    Check if movie is exists in TMDB 
    """
    # Check if the TMDB API key is set 
    if not TMDB_API_KEY or TMDB_API_KEY == "YOUR_TMDB_API_KEY":
        return False
    
    try:
        # Request headers with Bearer token authentication
        headers = {
            'Authorization': f'Bearer {TMDB_API_KEY}',
            'accept': 'application/json'
        }
        params = {
            'query': movie_title,
            'language': 'en-US'
        }
        # Send GET request to TMDB search endpoint
        response = requests.get(TMDB_SEARCH_URL, headers=headers, params=params, timeout=5)
        # Parse results from the API response
        results = response.json().get('results', [])
        # Movie exists if at least one result is returned
        return len(results) > 0
    except Exception as e:
        print(f"[ERROR] Failed to check movie in TMDB: {e}")
        return False


def find_matching_movie(user1_movie, user2_movie):
    """
    Find matching movies with Gemini Api only if it exists in TMDB 
    """
    if model is None:
        # Fallback to mock data if Gemini is not configured
        print("[INFO] Using fallback recommendations (Gemini not configured)")
        return get_fallback_recommendation(user1_movie, user2_movie)
    
    try:
        # Build Gemini prompt requesting 3 alternative movie recommendations
        # For further versions i will ask for 5 and store the recommendations to lower costs and to not trigger rate per day 
        # ,when user shuffles again with same movies i will use the stored data 
        prompt = f"""Sen bir film meraklısı ve tavsiye uzmanısın. İki kullanıcı şu filmleri seçti:

Kullanıcı 1: {user1_movie}
Kullanıcı 2: {user2_movie}

Bu iki filmi sevmiş olan birisi için, her iki filmin de özelliklerini (tür, tema, stil vb.) düşünerek, 3 alternatif film önerisi yap.

Önemli: Yalnızca GERÇEK VE ÜNLÜ filmler öner. Uydurma filmler değil!

Şu formatta yanıt ver (her biri ayrı satırda):
1. FİLM ADI | AÇIKLAMA
2. FİLM ADI | AÇIKLAMA
3. FİLM ADI | AÇIKLAMA

Örnek:
1. The Prestige | İntrikası ve düşündürücü yapısı ile ilginç.
2. Inception | Harika sinematografi ve düşündürücü senaryo.
3. The Dark Knight | İntrikası ve oyunculuğu ile etkileyici.

Şimdi cevapını ver:"""
        
        # Send request to Gemini
        response = model.generate_content(prompt, stream=False)
        response_text = response.text.strip()
        
        # Parse Gemini response into movie recommendations
        recommendations = []
        lines = response_text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line or '|' not in line:
                continue
            
             # Remove numbering (1., 2., 3.)
            cleaned_line = line
            for i in range(1, 4):
                if line.startswith(f"{i}."):
                    cleaned_line = line[len(f"{i}."):].strip()
                    break
            
            # Parse movie title and explanation
            parts = cleaned_line.split('|', 1)
            if len(parts) == 2:
                movie_title = parts[0].strip()
                reason = parts[1].strip()
                recommendations.append((movie_title, reason))
        
        print(f"[MATCH] Gemini recommendations for {user1_movie} & {user2_movie}: {recommendations}")
        
        # Search for first valid movie title in TMDB
        for movie_title, reason in recommendations:
            if movie_exists_in_tmdb(movie_title):
                print(f"[MATCH] Found valid TMDB movie: {movie_title}")
                backdrop_path = get_movie_backdrop(movie_title)
                return {
                    "movie": movie_title,
                    "reason": reason,
                    "backdrop_path": backdrop_path
                }
        
        # If none use fallback
        print(f"[WARNING] No valid TMDB movies found in recommendations, using fallback")
        fallback_result = get_fallback_recommendation(user1_movie, user2_movie)
        backdrop_path = get_movie_backdrop(fallback_result['movie'])
        fallback_result['backdrop_path'] = backdrop_path
        return fallback_result
    
    except Exception as e:
        print(f"[ERROR] Gemini API Error: {e}")
        # Use fallback suggestions
        fallback_result = get_fallback_recommendation(user1_movie, user2_movie)
        # Also get backdrop for fallback recommendation
        backdrop_path = get_movie_backdrop(fallback_result['movie'])
        fallback_result['backdrop_path'] = backdrop_path
        return fallback_result


# ==================== ROUTES ====================

@app.route('/')
def index():
    """Home"""
    return render_template('index.html')


@app.route('/api/search-movie', methods=['POST'])
def api_search_movie():
    data = request.get_json()
    query = data.get('query', '').strip()
    
    if len(query) < 2:
        return jsonify({'error': 'En az 2 karakter girin'}), 400
    
    movies = search_movies(query)
    
    if not movies:
        return jsonify({'error': 'Film bulunamadı', 'results': []}), 200
    
    return jsonify({'results': movies})


@app.route('/api/select-movie', methods=['POST'])
def api_select_movie():
    data = request.get_json()
    user = data.get('user')
    movie = data.get('movie')
    
    if not user or not movie:
        return jsonify({'error': 'Eksik parametreler'}), 400
    
    # Session'da filme ekle
    if 'selected_movies' not in session:
        session['selected_movies'] = {}
    
    session['selected_movies'][user] = movie
    session.modified = True
    
    print(f"[SESSION] {user} selected: {movie.get('title')}")
    
    return jsonify({'success': True, 'message': f'{user} filmi kaydedildi'})

# Find match with given 2 movies
@app.route('/api/find-match', methods=['POST'])
def api_find_match():
    selected_movies = session.get('selected_movies', {})
    
    if 'user1' not in selected_movies or 'user2' not in selected_movies:
        return jsonify({'error': 'Her iki kullanıcının da film seçmesi gerekir'}), 400
    
    user1_movie = selected_movies['user1'].get('title', 'Bilinmiyor')
    user2_movie = selected_movies['user2'].get('title', 'Bilinmiyor')
    
    print(f"[MATCH] Finding match for: {user1_movie} & {user2_movie}")
    
    # Get suggestion
    result = find_matching_movie(user1_movie, user2_movie)
    
    return jsonify({
        'success': True,
        'user1_movie': user1_movie,
        'user2_movie': user2_movie,
        'recommended_movie': result['movie'],
        'reason': result['reason'],
        'backdrop_path': result.get('backdrop_path')
    })

#
@app.route('/results')
def results():
    selected_movies = session.get('selected_movies', {})
    return render_template('results.html', selected_movies=selected_movies)


# Error handlers
@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404


@app.errorhandler(500)
def server_error(error):
    return render_template('500.html'), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))


