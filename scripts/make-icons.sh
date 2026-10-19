#!/bin/bash
# 白底黑字图标（不使用品牌红）
set -e
OUT="$1"
make_icon () {  # $1=size $2=out $3=内容占比
  S=$1; P=$3
  CW=$(python3 -c "print(int($S*$P))")
  CARD_W=$(python3 -c "print(int($CW*0.62))")
  CARD_H=$(python3 -c "print(int($CW*0.78))")
  X=$(python3 -c "print(int(($S-$CARD_W)/2))")
  Y=$(python3 -c "print(int(($S-$CARD_H)/2))")
  R=$(python3 -c "print(int($S*22/100))")
  convert -size "${S}x${S}" xc:none \
    -fill '#ffffff' -draw "roundrectangle 0,0,$((S-1)),$((S-1)),$R,$R" \
    -stroke '#d4d4d8' -strokewidth $((S/128>1?S/128:1)) -fill none \
    -draw "roundrectangle 0,0,$((S-1)),$((S-1)),$R,$R" \
    -stroke none -fill '#111111' \
    -draw "roundrectangle $X,$Y,$((X+CARD_W)),$((Y+CARD_H)),$((S*4/100)),$((S*4/100))" \
    -fill '#ffffff' \
    -draw "rectangle $((X+CARD_W*16/100)),$((Y+CARD_H*14/100)) $((X+CARD_W*74/100)),$((Y+CARD_H*22/100))" \
    -draw "rectangle $((X+CARD_W*16/100)),$((Y+CARD_H*34/100)) $((X+CARD_W*64/100)),$((Y+CARD_H*42/100))" \
    -draw "rectangle $((X+CARD_W*16/100)),$((Y+CARD_H*54/100)) $((X+CARD_W*74/100)),$((Y+CARD_H*62/100))" \
    -stroke '#ffffff' -strokewidth $((S*6/100)) -fill none \
    -draw "polyline $((X+CARD_W*24/100)),$((Y+CARD_H*78/100)) $((X+CARD_W*44/100)),$((Y+CARD_H*90/100)) $((X+CARD_W*84/100)),$((Y+CARD_H*70/100))" \
    "$2"
}
make_icon 192 "$OUT/icon-192.png" 0.86
make_icon 512 "$OUT/icon-512.png" 0.86
make_icon 512 "$OUT/icon-maskable-512.png" 0.66
make_icon 180 "$OUT/apple-touch-icon.png" 0.86
