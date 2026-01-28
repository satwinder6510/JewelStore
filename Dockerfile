FROM node:18

# Install Python and pip
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy Python requirements and install
COPY requirements.txt ./
RUN pip3 install --break-system-packages -r requirements.txt

# Copy app source
COPY . .

# Create necessary directories
RUN mkdir -p uploads generated backgrounds props

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]
