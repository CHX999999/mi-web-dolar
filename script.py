from flask import Flask, render_template_string
import requests

app = Flask(__name__)

PAGINA_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="{{ url_for('static', filename='style.css') }}">
    <title>Dólar Hoy</title>
</head>
<body>
    <h1>DÓLAR HOY</h1>
    <div class="container">
        {% for nombre, info in dolares.items() %}
        <div class="card">
            <h3>{{ nombre }}</h3>
            <div class="precio-caja">
                <span>Compra: <span class="monto">${{ info.compra }}</span></span>
                <span>Venta: <span class="monto">${{ info.venta }}</span></span>
            </div>
        </div>
        {% endfor %}
    </div>
</body>
</html>
"""

def obtener_precios_dolar():
    try:
        url = "https://dolarapi.com/v1/dolares"
        response = requests.get(url)
        data = response.json()
        precios = {}
        for item in data:
            if item['nombre'] in ['Oficial', 'Blue', 'Tarjeta']:
                precios[f"Dólar {item['nombre']}"] = {
                    'compra': item['compra'] if item['compra'] else '-',
                    'venta': item['venta'] if item['venta'] else '-'
                }
        return precios
    except:
        return {"Error": {"compra": "-", "venta": "-"}}

@app.route('/')
def inicio():
    return render_template_string(PAGINA_HTML, dolares=obtener_precios_dolar())

if __name__ == '__main__':
    app.run(debug=True, port=5000)