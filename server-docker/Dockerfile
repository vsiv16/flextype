FROM ubuntu:latest

# Update package manager (apt-get) and install (with the yes flag `-y`) Python and Pip
RUN apt-get update && apt-get install -y \
    python3.9 \
    python3-pip

# copy all content from local folder to image
COPY . /app

# switch working directory
WORKDIR /app/

# install required dependencies
RUN pip3 install torch -f https://download.pytorch.org/whl/torch_stable.html
RUN pip3 install -r requirements.txt

# load ML model, tokenizer, labels, etc.
RUN python3 /app/load_model.py

# configure container to run wsgi server
CMD ["uwsgi", "--http", ":9090", \
              "--wsgi-file", "/app/app.py", \
              "--callable", "app"]