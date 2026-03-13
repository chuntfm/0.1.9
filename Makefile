DIST := dist

.PHONY: install build clean serve open rebuild

install:
	uv pip install -r requirements.txt

build:
	uv run build.py

clean:
	rm -rf $(DIST)

rebuild: clean build

serve: build
	@echo "http://localhost:8000"
	cd $(DIST) && uv run python -m http.server 8000

open: build
	open $(DIST)/index.html
