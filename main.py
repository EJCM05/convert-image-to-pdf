import io
from fastapi import FastAPI, File, UploadFile, Form
# Cambio 1: Importar 'Response' además de 'FileResponse'
from fastapi.responses import FileResponse, Response 
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageEnhance
import uvicorn

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_root():
    """Sirve el archivo index.html principal."""
    # Esto está bien, 'static/index.html' SÍ es un archivo en disco
    return FileResponse('static/index.html')

@app.post("/process-image")
async def process_image(
    image: UploadFile = File(...),
    brightness: float = Form(1.0),
    sharpness: float = Form(1.0),
    contrast: float = Form(1.0),
    grayscale: bool = Form(False)
):
    """
    Recibe una imagen, aplica filtros y la devuelve como PDF.
    """
    try:
        contents = await image.read()
        img = Image.open(io.BytesIO(contents))

        if grayscale:
            img = img.convert("L")
        else:
            if img.mode != 'RGB':
                img = img.convert('RGB')

        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(brightness)

        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(contrast)

        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(sharpness)

        pdf_buffer = io.BytesIO()
        if img.mode == 'RGBA':
             img = img.convert('RGB')
        img.save(pdf_buffer, format='PDF', resolution=100.0)
        pdf_buffer.seek(0)
        return Response(
            content=pdf_buffer.getvalue(),
            media_type='application/pdf',
            headers={"Content-Disposition": "attachment; filename=documento_escaneado.pdf"}
        )

    except Exception as e:
        return {"error": str(e)}, 500


@app.get("/sw.js", response_class=FileResponse)
async def service_worker():
    return FileResponse('static/sw.js', media_type='application/javascript')


@app.get("/manifest.json", response_class=FileResponse)
async def manifest():
    return FileResponse('static/manifest.json', media_type='application/manifest+json')



# --- Ejecución (para pruebas) ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)