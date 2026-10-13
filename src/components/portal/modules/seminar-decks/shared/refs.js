/* ============================================================================
   SEMINAR DECKS — REFERENCES (IEEE, as the dissertation's IEEEtran.bst prints
   them; bibliography of build/dissertation.pdf, 12 Oct 2026). ASCII only, so
   long author lists use "et al." and page ranges a hyphen.
   Each deck numbers the works in the order its slides first cite them
   (engine/sequence.js), and its references backup slide lists them in that
   order. `short` is the on-slide footer form.
   ========================================================================== */

export const REFS = {
  gandaglia2021: {
    short: 'Gandaglia et al., Eur Urol Oncol 2021',
    ieee: 'G. Gandaglia, R. Leni, F. Bray, N. Fleshner, S. J. Freedland, A. Kibel, P. Stattin, H. Van Poppel, and C. La Vecchia, "Epidemiology and prevention of prostate cancer," European Urology Oncology, vol. 4, no. 6, pp. 877-892, 2021.',
  },
  kendrick2022: {
    short: 'Kendrick et al., Eur J Nucl Med Mol Imaging 2022',
    ieee: 'J. Kendrick, R. J. Francis, G. M. Hassan, P. Rowshanfarzad, J. S. L. Ong, and M. A. Ebert, "Fully automatic prognostic biomarker extraction from metastatic prostate lesion segmentations in whole-body [68Ga]Ga-PSMA-11 PET/CT images," European Journal of Nuclear Medicine and Molecular Imaging, vol. 50, pp. 67-79, 2022.',
  },
  sheikhbahaei2017: {
    short: 'Sheikhbahaei et al., Eur J Nucl Med Mol Imaging 2017',
    ieee: 'S. Sheikhbahaei, A. Afshar-Oromieh, M. Eiber et al., "Pearls and pitfalls in clinical interpretation of prostate-specific membrane antigen (PSMA)-targeted PET imaging," European Journal of Nuclear Medicine and Molecular Imaging, vol. 44, pp. 2117-2136, 2017.',
  },
  isensee2021: {
    short: 'Isensee et al., Nature Methods 2021',
    ieee: 'F. Isensee, P. F. Jaeger, S. A. A. Kohl, J. Petersen, and K. H. Maier-Hein, "nnU-Net: A self-configuring method for deep learning-based biomedical image segmentation," Nature Methods, vol. 18, no. 2, pp. 203-211, 2021.',
  },
  isensee2024: {
    short: 'Isensee et al., MICCAI 2024',
    ieee: 'F. Isensee, T. Wald, C. Ulrich, M. Baumgartner, S. Roy, K. Maier-Hein, and P. F. Jaeger, "nnU-Net revisited: A call for rigorous validation in 3D medical image segmentation," in Medical Image Computing and Computer Assisted Intervention (MICCAI 2024), 2024.',
  },
  gu2023: {
    short: 'Gu and Dao, arXiv 2023',
    ieee: 'A. Gu and T. Dao, "Mamba: Linear-time sequence modeling with selective state spaces," arXiv preprint arXiv:2312.00752, 2023.',
  },
  ma2024: {
    short: 'Ma et al., arXiv 2024',
    ieee: 'J. Ma, F. Li, and B. Wang, "U-Mamba: Enhancing long-range dependency for biomedical image segmentation," arXiv preprint arXiv:2401.04722, 2024.',
  },
  xing2024a: {
    short: 'Xing et al., MICCAI 2024',
    ieee: 'Z. Xing, T. Ye, Y. Yang, G. Liu, and L. Zhu, "SegMamba: Long-range sequential modeling Mamba for 3D medical image segmentation," in Medical Image Computing and Computer Assisted Intervention (MICCAI 2024), 2024.',
  },
  rokuss2024: {
    short: 'Rokuss et al., arXiv 2024',
    ieee: 'M. Rokuss, B. Kovacs, Y. Kirchhoff, S. Xiao, C. Ulrich, K. H. Maier-Hein, and F. Isensee, "From FDG to PSMA: A hitchhiker\'s guide to multitracer, multicenter lesion segmentation in PET/CT imaging," arXiv preprint arXiv:2409.09478, 2024.',
  },
  wasserthal2023: {
    short: 'Wasserthal et al., Radiol Artif Intell 2023',
    ieee: 'J. Wasserthal, H.-C. Breit, M. T. Meyer, M. Pradella, D. Hinck, A. W. Sauter, T. Heye, D. T. Boll, J. Cyriac, S. Yang, M. Bach, and M. Segeroth, "TotalSegmentator: Robust segmentation of 104 anatomic structures in CT images," Radiology: Artificial Intelligence, vol. 5, no. 5, p. e230024, 2023.',
  },
  jeblick2026: {
    short: 'Jeblick et al., Sci Data 2026',
    ieee: 'K. Jeblick, B. Schachtner, A. Mittermeier et al., "A whole-body PSMA-PET/CT dataset with manually annotated tumor lesions," Scientific Data, vol. 13, p. 1023, 2026.',
  },
  jackson2025: {
    short: 'Jackson et al., DEEP-PSMA design document 2025',
    ieee: 'P. Jackson, L. McIntosh, J. Buteau, and M. Hofman, "Deep-learning evaluation for enhanced prognostics - prostate specific membrane antigen (DEEP-PSMA)," Challenge design document (Biomedical Image Analysis Challenges initiative), Zenodo, 2025, not peer-reviewed.',
  },
  maierhein2024: {
    short: 'Maier-Hein et al., Nature Methods 2024',
    ieee: 'L. Maier-Hein, A. Reinke, P. Godau et al., "Metrics reloaded: Recommendations for image analysis validation," Nature Methods, vol. 21, no. 2, pp. 195-212, 2024.',
  },
  salehi2017: {
    short: 'Salehi et al., MLMI 2017',
    ieee: 'S. S. M. Salehi, D. Erdogmus, and A. Gholipour, "Tversky loss function for image segmentation using 3D fully convolutional deep networks," in Machine Learning in Medical Imaging (MLMI), MICCAI Workshop, 2017.',
  },
  dosovitskiy2021: {
    short: 'Dosovitskiy et al., ICLR 2021',
    ieee: 'A. Dosovitskiy, L. Beyer, A. Kolesnikov et al., "An image is worth 16x16 words: Transformers for image recognition at scale," in International Conference on Learning Representations (ICLR), 2021.',
  },
};
