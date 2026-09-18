"""Names and controls for the preserved Mortensen cervical model."""

GROUPS = {
    "stern_mast": "SCM · sternal–mastoid compartment",
    "cleid_mast": "SCM · clavicular–mastoid compartment",
    "cleid_occ": "SCM · clavicular–occipital compartment",
    "scalenus_ant": "Anterior scalene",
    "scalenus_med": "Middle scalene",
    "scalenus_post": "Posterior scalene",
    "long_cap_sklc4": "Longus capitis",
    "long_col_c1thx": "Longus colli · C1–thorax compartment",
    "long_col_c1c5": "Longus colli · C1–C5 compartment",
    "long_col_c5thx": "Longus colli · C5–thorax compartment",
    "trap_cl": "Trapezius · clavicular compartment",
    "trap_acr": "Trapezius · acromial compartment",
    "splen_cap_sklc6": "Splenius capitis · skull–C6 compartment",
    "splen_cap_sklthx": "Splenius capitis · skull–thorax compartment",
    "splen_cerv_c3thx": "Splenius cervicis",
    "semi_cap_sklc5": "Semispinalis capitis · skull–C5 compartment",
    "semi_cap_sklthx": "Semispinalis capitis · skull–thorax compartment",
    "semi_cerv_c3thx": "Semispinalis cervicis",
    "levator_scap": "Levator scapulae",
    "longissi_cap_sklc6": "Longissimus capitis",
    "longissi_cerv_c4thx": "Longissimus cervicis",
    "iliocost_cerv_c5rib": "Iliocostalis cervicis",
    "rectcap_post_maj": "Rectus capitis posterior major",
    "rectcap_post_min": "Rectus capitis posterior minor",
    "obl_cap_sup": "Obliquus capitis superior",
    "obl_cap_inf": "Obliquus capitis inferior",
}
NAMES = {
    stem + suffix: side + " " + label
    for stem, label in GROUPS.items()
    for suffix, side in [("", "Right"), ("_L", "Left")]
}
CONTROLS = [
    dict(
        id="pitch2",
        axis="L1",
        label="Lower neck flexion / extension",
        detail="Positive = extension; negative = flexion. Distributed from T1 to C2.",
        min=-25,
        max=30,
    ),
    dict(
        id="yaw2",
        axis="L2",
        label="Lower neck rotation",
        detail="Positive = turn left; negative = turn right. Distributed from T1 to C2.",
        min=-20,
        max=20,
    ),
    dict(
        id="roll2",
        axis="L3",
        label="Lower neck side bend",
        detail="Positive = tilt right; negative = tilt left. Distributed from T1 to C2.",
        min=-20,
        max=20,
    ),
    dict(
        id="pitch1",
        axis="U1",
        label="Upper neck flexion / extension",
        detail="Positive = tilt the chin up; negative = nod down. Distributed from C2 to skull.",
        min=-12,
        max=15,
    ),
    dict(
        id="yaw1",
        axis="U2",
        label="Upper neck rotation",
        detail="Positive = turn left; negative = turn right. Distributed from C2 to skull.",
        min=-30,
        max=30,
    ),
    dict(
        id="roll1",
        axis="U3",
        label="Upper neck side bend",
        detail="Positive = tilt right; negative = tilt left. Distributed from C2 to skull.",
        min=-5,
        max=5,
    ),
]
