export default function TibialisAnteriorEvidence() {
  return (
    <div
      className="bio-muscle-evidence"
      aria-label="Tibialis anterior anatomy and evidence"
    >
      <p>
        <strong>Anatomical origin:</strong> A broad area on the upper lateral
        tibia and adjacent interosseous membrane. The upper model dot represents
        one endpoint within a simplified route, not the upper edge of this area.
      </p>
      <p>
        <strong>Anatomical insertion:</strong> Medial cuneiform and base of the
        first metatarsal, on the inner side of the foot. The model groups these
        bones into its heel / foot segment.
      </p>
      <p>
        <strong>Action to learn:</strong> Dorsiflexion brings the foot toward
        the shin. Tibialis anterior also contributes to inversion; its leverage
        depends on foot position. It does not cross the knee.
      </p>
      <details>
        <summary>Evidence and model limits</summary>
        <p>
          The ankle length-change direction agrees with anatomical and
          experimental evidence. Exact lengths and moment arms belong to this
          generic model; they are not measurements of you or the orange atlas
          muscle. The endpoint locations have not been validated against that
          atlas.
        </p>
        <p>
          The model predicts an inversion pull throughout its subtalar sweep.
          Human measurements also found an eversion pull in everted positions.
          Use these subtalar numbers as model predictions, not a rule that the
          muscle always pulls inward.
        </p>
        <p className="bio-evidence-sources">
          <a
            href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9277928/"
            target="_blank"
            rel="noreferrer"
          >
            Origin study ↗
          </a>
          {" · "}
          <a
            href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6359855/"
            target="_blank"
            rel="noreferrer"
          >
            Insertion study ↗
          </a>
          {" · "}
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/10673122/"
            target="_blank"
            rel="noreferrer"
          >
            Ankle leverage ↗
          </a>
          {" · "}
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/19019375/"
            target="_blank"
            rel="noreferrer"
          >
            Position-dependent action ↗
          </a>
        </p>
      </details>
    </div>
  );
}
