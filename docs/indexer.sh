#!/bin/bash

input="src.md"
indexed="index.md"

out="tmp.indexed.md"
index="tmp.index.md"

cp "$input" "$out"

tab='\t'
i=(-1 1)
prevLen=0
while read -r line; do
    hash="$(md5sum <<< "$line" | cut -d ' ' -f 1)"
    printf "<a id=\"%s\"/>\n\n%s\n\n" "$hash" "$line" > tmp
    sed "/$line/ {
        x
        r tmp
    }" "$out" > "${out}.tmp"
    mv "${out}.tmp" "$out"
    hdrLen=$(awk -F'#' '{print NF-1}' <<< "$line")
    hdrTxt="${line//#/}"
    (( hdrLen > 1 )) && for (( j=1; j<hdrLen; j++ )); do echo -en "$tab"; done
    (( prevLen < hdrLen )) && i[$hdrLen]=1
    printf "%d. [%s ](#%s)\n" ${i[$hdrLen]} "$hdrTxt" "$hash"
    prevLen=$hdrLen
    let i[$hdrLen]++
done <<< "$(grep --color=no -E "^#+ " "$input")" > "$index"

cat "$out" > "$out".tmp
printf "# Содержание\n" > "$out"
cat "$index" >> "$out"
cat "$out".tmp >> "$out"

rm "$index"
rm tmp
rm "$out".tmp

mv "$out" "$indexed"
cat "$input" >> "$indexed"
