FILES=$(shell find . -name '*.md' -type f -print | sort)

.PHONY: all refresh watch

all: report.html

report.md.out: ${FILES}
	cat $^ > $@

report.html: report.md.out
	pandoc --from=markdown --to=html5 --standalone --toc --smart --section-divs --css=2pi.css --mathjax $< -o $@

refresh: all
	xdotool key --window $(shell xdotool search --name "Report" | head -1) F5

watch: refresh
	while : ; do inotifywait -e close_write . ; make refresh ; done
