from flask import Flask, render_template, request, jsonify, session
import requests
import os
from config import TMDB_API_KEY, GEMINI_API_KEY, SECRET_KEY
# import google.generativeai as genai
from datetime import timedelta

# # Environment variables yükle
# load_dotenv()

# Flask uygulamasını başlat
app = Flask(__name__)

# Flask yapılandırması
# app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'sana_ozel_ve_cok_gizli_bir_key')
app.config['SECRET_KEY'] = SECRET_KEY
app.config['SESSION_COOKIE_DURATION'] = timedelta(hours=1)
app.permanent_session_lifetime = timedelta(hours=1)

# API Base URLs
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_SEARCH_URL = f"{TMDB_BASE_URL}/search/movie"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"


def search_movies(query):
    """
    MovieDB API'den film ara
    """
    if not TMDB_API_KEY or TMDB_API_KEY == "YOUR_TMDB_API_KEY":
        # Mock data
        return [
            {"id": 1, "title": query, "year": 2024, "poster_path": None},
        ]
    
    try:
        headers = {
            'Authorization': f'Bearer {TMDB_API_KEY}',
            'accept': 'application/json'
        }
        params = {
            'query': query,
            'language': 'en-US'  
        }
        
        # Debug: Bul isteğin tam URL'sini
        full_url = TMDB_SEARCH_URL + '?' + '&'.join([f'{k}={v}' for k, v in params.items()])
        print(f"[DEBUG] Requesting: {full_url}")
        print(f"[DEBUG] Headers: {headers}")
        
        response = requests.get(TMDB_SEARCH_URL, headers=headers, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        print(f"[DEBUG] API Response: {data}")
        
        movies = []
        for movie in data.get('results', [])[:10]:  # İlk 10 sonuç
            release_date = movie.get('release_date', '')
            year = release_date[:4] if release_date else 'N/A'
            
            movies.append({
                'id': movie.get('id'),
                'title': movie.get('title'),
                'year': year,
                'backdrop_path': movie.get('backdrop_path'),
                'overview': movie.get('overview', '')
            })
        
        print(f"[SEARCH] Query: '{query}' -> Found {len(movies)} movies")
        return movies
    
    except requests.RequestException as e:
        print(f"[ERROR] TMDB API Error: {e}")
        return []


def find_matching_movie(user1_movie, user2_movie):
    """
    İki filmin ortak noktasında bir film öner (şimdilik mock data)
    """
    # Mock data - daha sonra Gemini ile değiştirilecek
    matching_movies = [
        ("The Shawshank Redemption", "Her iki filmin de karakter derinliği ve duygusal hikaye sunmaktadır."),
        ("Inception", "Harika sinematografi ve düşündürücü senaryo ile bilim kurgu severler için mükemmel."),
        ("The Dark Knight", "İntrikası ve oyunculuğu ile her iki film severini tatmin edecektir."),
        ("Forrest Gump", "Esinlendirici ve duygusal hikaye her zaman tutuluyor."),
        ("Interstellar", "Bilim kurgu ve duygusal derinlik kombinasyonu harika."),
        ("Pulp Fiction", "Yapısı ve karakterleri ile film meraklılarını hoşlandıracaktır."),
        ("The Green Mile", "İnsani değerleri ve derinlik ile dikkat çeker."),
        ("Goodfellas", "Sinematografi ve hikaye anlatımı ile başarılıdır.")
    ]
    
    import random
    movie, reason = random.choice(matching_movies)
    
    print(f"[MATCH] User1: {user1_movie}, User2: {user2_movie} -> Recommended: {movie}")
    
    return {
        "movie": movie,
        "reason": reason
    }


# ==================== ROUTES ====================

@app.route('/')
def index():
    """Anasayfa"""
    return render_template('index.html')


@app.route('/api/search-movie', methods=['POST'])
def api_search_movie():
    """
    Film ara endpoint
    POST JSON: { "query": "film adı" }
    """
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
    """
    Kullanıcının seçtiği filmi session'a kaydet
    POST JSON: { "user": "user1" or "user2", "movie": {...} }
    """
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


@app.route('/api/find-match', methods=['POST'])
def api_find_match():
    """
    İki filmin ortak noktasında bir film bul
    """
    selected_movies = session.get('selected_movies', {})
    
    if 'user1' not in selected_movies or 'user2' not in selected_movies:
        return jsonify({'error': 'Her iki kullanıcının da film seçmesi gerekir'}), 400
    
    user1_movie = selected_movies['user1'].get('title', 'Bilinmiyor')
    user2_movie = selected_movies['user2'].get('title', 'Bilinmiyor')
    
    print(f"[MATCH] Finding match for: {user1_movie} & {user2_movie}")
    
    # Önerme al
    result = find_matching_movie(user1_movie, user2_movie)
    
    return jsonify({
        'success': True,
        'user1_movie': user1_movie,
        'user2_movie': user2_movie,
        'recommended_movie': result['movie'],
        'reason': result['reason']
    })


@app.route('/results')
def results():
    """Sonuçlar sayfası"""
    selected_movies = session.get('selected_movies', {})
    return render_template('results.html', selected_movies=selected_movies)


# Error handlers
@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404


@app.errorhandler(500)
def server_error(error):
    return render_template('500.html'), 500


if __name__ == '__main__':
    app.run(debug=True)
