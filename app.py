from flask import Flask, render_template, request, redirect, url_for
import requests # API çağrıları için

# Flask uygulamasını başlat
app = Flask(__name__)

# Flask yapılandırması
app.config['SECRET_KEY'] = 'sana_ozel_ve_cok_gizli_bir_key'

# TMDB API Bilgileri (Burayı kendi anahtarınızla DOLDURMALISINIZ)
TMDB_API_KEY = "YOUR_TMDB_API_KEY" 
TMDB_BASE_URL = "https://api.themoviedb.org/3/search/movie"

def validate_movie_name(movie_name):
    """
    Kullanıcının girdiği film adını harici bir API (TMDB) kullanarak doğrular
    ve veritabanındaki resmi ismini döndürür.
    """
    cleaned_name = movie_name.strip()
    
    # Eğer API Anahtarı hala placeholder ise veya boşsa, API'ye gitme
    if not TMDB_API_KEY or TMDB_API_KEY == "YOUR_TMDB_API_KEY":
        # API'sız çalışma (sadece metin temizliği)
        return cleaned_name.title()

    try:
        params = {
            'api_key': TMDB_API_KEY,
            'query': cleaned_name,
            'language': 'tr-TR' # Türkçe veya İngilizce sonuçlar için ayarlanabilir
        }
        
        # Gerçek API çağrısı yapılıyor
        response = requests.get(TMDB_BASE_URL, params=params, timeout=5)
        response.raise_for_status() # HTTP 4xx veya 5xx hatası varsa hata fırlat
        data = response.json()
        
        if data['results']:
            # En iyi eşleşmeyi (ilk sonucu) resmi isim olarak kullan
            return data['results'][0]['title']
        
    except requests.RequestException as e:
        # API veya bağlantı hatası durumunda, hata mesajını yazdır ve temizlenmiş adı döndür
        print(f"HATA: TMDB API'ye ulaşılamadı veya sorgu başarısız oldu: {e}")
        
    # Eşleşme bulunamazsa veya API hatası olursa, kullanıcı adını baş harfleri büyük döndür.
    return cleaned_name.title()


@app.route('/')
def index():
    """
    Anasayfayı (giriş/planlama ekranını) render eder.
    """
    # Bu fonksiyon sadece templates/index.html'i yükler. 
    # Sayfa tasarımı ve planlamayı görebilmen için yeterlidir.
    return render_template('index.html')


@app.route('/match', methods=['POST'])
def match():
    """
    Formdan gelen film listelerini işler, doğrular ve ortak filmleri bulur.
    """
    raw_lists = request.form.getlist('user_movies[]')

    processed_lists = []
    
    for user_list_str in raw_lists:
        raw_movies = [movie.strip() for movie in user_list_str.splitlines() if movie.strip()]
        
        # Her film adını API aracılığıyla DOĞRULA ve TEMİZLE
        cleaned_movies = [validate_movie_name(movie) for movie in raw_movies]
        
        if cleaned_movies:
            # İşlenmiş ve benzersiz film listesini (küme olarak) ekle
            processed_lists.append(set(cleaned_movies))

    if len(processed_lists) < 2:
        return render_template('results.html', matched_movies=[], error="Lütfen en az iki kullanıcının listesini doldurun.")

    # Ortak filmleri bulmak için KÜME (SET) KESİŞİMİ
    common_movies_set = processed_lists[0]

    for i in range(1, len(processed_lists)):
        common_movies_set = common_movies_set.intersection(processed_lists[i])
        
    # Sonuçları listeye çevirip templates/results.html'e gönder
    return render_template(
        'results.html', 
        matched_movies=sorted(list(common_movies_set)),
        all_lists=[list(s) for s in processed_lists]
    )


# Uygulamanın doğrudan çalıştırılması için
if __name__ == '__main__':
    # Flask sunucusunu başlat. debug=True ile değişiklikler otomatik yenilenir.
    app.run(debug=True)
