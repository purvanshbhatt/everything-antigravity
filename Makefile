.PHONY: test verify status shield compact install clean

test:
	python3 -m pytest tests/ -v

verify:
	python3 src/cli.py verify

status:
	python3 src/cli.py status

install:
	./install.sh

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
