import os
import io
import requests
import xml.etree.ElementTree as ET
from PIL import Image

# ============================================================
# CONFIGURACIÓN
# ============================================================
POKEMON_PATHS = {
    "Bulbasaur": "sprite/0001/0001",
    "Ivysaur":   "sprite/0002/0001",
    "Venusaur":  "sprite/0003/0003",
}

# Filas del formato PMD
ROW_FRONT  = 0   # Down  → de frente (correr hacia la cámara)
ROW_RIGHT  = 2   # Right → derecha
ROW_LEFT   = 6   # Left  → izquierda

# Vistas que queremos exportar (nombre, fila)
VIEWS = {
    "front":  ROW_FRONT,
    "right":  ROW_RIGHT,
    "left":   ROW_LEFT,
}

# Animaciones candidatas, en orden de preferencia.
# 'Run' es la ideal para Subway Surfers; si no existe, cae a 'Walk'.
ANIM_PREFERENCE = ["Run", "Walk"]

OUTPUT_DIR = "sprites_subway_pokemon"
# ============================================================


def descargar_bytes(url: str) -> bytes:
    respuesta = requests.get(url, timeout=30)
    respuesta.raise_for_status()
    return respuesta.content


def listar_animaciones(xml_bytes: bytes) -> dict:
    """Devuelve {nombre_anim: (frame_width, frame_height)} desde AnimData.xml."""
    raiz = ET.fromstring(xml_bytes)
    anims = {}
    for anim in raiz.findall("./Anims/Anim"):
        nombre = anim.find("Name")
        ancho  = anim.find("FrameWidth")
        alto   = anim.find("FrameHeight")
        if nombre is not None and ancho is not None and alto is not None:
            anims[nombre.text] = (int(ancho.text), int(alto.text))
    return anims


def extraer_animacion(pokemon: str, ruta_base: str, anim_name: str,
                      frame_w: int, frame_h: int):
    """Descarga <anim_name>-Anim.png y exporta las vistas front/right/left."""
    base_url = f"https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/{ruta_base}"
    file_name = f"{anim_name}-Anim.png"

    print(f"[{pokemon}] Descargando {file_name}...")
    try:
        png_bytes = descargar_bytes(f"{base_url}/{file_name}")
    except requests.HTTPError as e:
        print(f"[{pokemon}] No se pudo descargar {file_name}: {e}")
        return False

    hoja = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    ancho_total, alto_total = hoja.size
    num_columnas = ancho_total // frame_w

    if alto_total < 8 * frame_h:
        print(f"[{pokemon}] La hoja de '{anim_name}' no tiene las 8 filas esperadas. Se omite.")
        return False

    for vista, fila in VIEWS.items():
        carpeta = os.path.join(OUTPUT_DIR, pokemon.lower(), vista)
        os.makedirs(carpeta, exist_ok=True)
        for col in range(num_columnas):
            izq   = col * frame_w
            arr   = fila * frame_h
            der   = izq + frame_w
            ab    = arr + frame_h
            frame = hoja.crop((izq, arr, der, ab))
            ruta  = os.path.join(carpeta, f"{vista}_{col:02d}.png")
            frame.save(ruta, "PNG")
        print(f"[{pokemon}] {num_columnas} frames guardados en '{carpeta}'")
    return True


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for pokemon, ruta in POKEMON_PATHS.items():
        try:
            base_url = f"https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/{ruta}"
            print(f"\n=== {pokemon} ===")
            xml_bytes = descargar_bytes(f"{base_url}/AnimData.xml")
            anims = listar_animaciones(xml_bytes)
            print(f"[{pokemon}] Animaciones disponibles: {sorted(anims.keys())}")

            # Elegir la primera animación disponible según preferencia
            elegida = next((a for a in ANIM_PREFERENCE if a in anims), None)
            if elegida is None:
                print(f"[{pokemon}] No hay '{'/'.join(ANIM_PREFERENCE)}'. Se omite.")
                continue

            fw, fh = anims[elegida]
            print(f"[{pokemon}] Usando animación '{elegida}' ({fw}x{fh})")
            extraer_animacion(pokemon, ruta, elegida, fw, fh)

        except Exception as e:
            print(f"❌ Error con {pokemon}: {e}")


if __name__ == "__main__":
    main()