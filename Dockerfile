# Use Python 3.10 slim image for Google Cloud Run
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy requirements file first (for better Docker layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the lib/ folder containing Python services
COPY lib/ ./lib/

# Copy the main entrypoint file (to be created next)
COPY main.py .

# Expose port 8080 for Google Cloud Run
EXPOSE 8080

# Run the main.py file
CMD ["python", "main.py"]
