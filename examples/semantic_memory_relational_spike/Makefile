INCAN ?= incan

.PHONY: demo test

demo:
	$(INCAN) oven bake --project .
	$(INCAN) run --locked

test:
	$(INCAN) oven bake --project .
	$(INCAN) test tests --locked
