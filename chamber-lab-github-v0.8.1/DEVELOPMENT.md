# 実装の記録と更新履歴

元の開発記録です。冒頭の機能一覧・制限には過去の版の記述が含まれます。現行版の概要は README.md、具体的な計算範囲はアプリ内の説明を参照してください。公開先のフォルダ名は、この配布版では `dist/` から `docs/` に変更しています。

# Chamber Lab

A Japanese-language research prototype for complexified real affine line arrangements, built around Yoshinaga's minimal chamber cochain complex. A dependency-free static application; all user calculations stay in the browser. It starts with the decone of the projective A3 arrangement.

## Implemented

- Draw lines through two points, snapping exactly to rational grid points or existing intersections; edit equations in the catalog’s exact real number field; import/export JSON; undo; zoom and pan.
- Rotate the view, align the flag horizontally below all finite vertices, and rotate an individual line about an exact movable pivot.
- 36 exact rational Grünbaum/CEL catalogue realizations, plus deleted B3, pencils, grids, general-position examples and Falk's Example 3.13. The 33 newly transcribed entries include published projective t-vectors and central region counts for independent checks. Yoshinaga’s 16-plane icosidodecahedral and the 11-plane double-star projective arrangements are stored in exact Q(sqrt(5)) coordinates.
- Enumerate every chamber exactly, independently of the viewport. Classify by an adapted generic flag F0 ⊂ F1; label the minimal basis and select chambers or differential entries to inspect signs, separating lines and degree.
- Rank-one local system homology and cohomology over cyclotomic fields, with optional floating-point complex monodromies. Show representative coordinate vectors for H1/H^1.
- Aomoto cohomology over Q and prime finite fields.
- Complex Milnor-fiber Betti numbers and monodromy eigenspace dimensions. The input's projective completion includes the line at infinity, so the fiber is z product_i(a_i x+b_i y+c_i z)=1 and its cover degree is n+1.
- Characteristic/resonance jump loci via exact universal matrices, determinantal descriptions and SageMath exports. Membership at specified parameters, plus the local resonance subspaces from multiple points. No irreducible decomposition is claimed.

## Mathematical conventions

Put X_C = Sep(C0,C), and let t_i be positive-meridian monodromy. We use the rescaled chamber matrix

    d[D,C] = deg(C,D) (product_{i in X_D \ X_C} t_i
                                - product_{i in X_C \ X_D} t_i^{-1}).

This is obtained from the usual half-monodromy formula by scaling the basis at C by (product_{i in X_C} t_i^{1/2})^{-1}. Thus all displayed universal entries are Laurent polynomials in the monodromies. Its linearization at t_i=exp(s a_i) is

    delta[D,C] = deg(C,D) sum_{i in Sep(C,D)} a_i.

The flag is restricted to one with all finite vertices on one side and F0 before all intersections, so the explicit one-dimensional degree formula applies. Generic separating flags may still be displayed and classified, but their calculations are disabled. Non-generic flags and coincident lines are rejected. Exact Laurent multiplication verifies d1*d0=0 whenever a model changes.

Local system homology is computed by dualizing the complex for the dual local system: partial1=d0(t^{-1})^T and partial2=d1(t^{-1})^T. Milnor cohomology uses t_i=lambda^{-1} for the pullback action of geometric monodromy. Rationality permits grouping all primitive d-th eigenvalues together.

For k>=1, let B=d0 ⊕ d1. Since dim H^1=n-rank(d0)-rank(d1), the (n-k+1)-minors of B give the global jump-locus condition, including the identity character/origin. The Laurent ring in the characteristic export already restricts to the algebraic torus.

## Limits

- At most20 affine lines in one catalogued real number field. Five degree2/3 fields are registered with minimal polynomials and real isolating intervals; arbitrary composita and pseudolines are not implemented.
- Cyclotomic order <=60, degree phi(N)<=24. Exact arithmetic uses BigInt rational fractions and reduction modulo the cyclotomic polynomial. Numerical complex arithmetic uses a 1e-8 absolute pivot threshold and is explicitly labeled approximate.
- Integral Milnor homology and torsion, integer cycles, geometric representatives, complete catalogue imports, global component decomposition, and flag-change comparison maps are future work.
- Only rank-one local systems and the two-dimensional arrangement complement are supported.
- K(pi,1) classification uses certified one-sided tests, not a general decision algorithm. The implemented Falk test is the balanced-weight Corollary 3.10; unrestricted corner-weight optimization is not implemented.

## Run / verify

Serve `dist/` as ordinary static files. No install or build step is needed. `npm test` runs all suites. The original `node test.mjs` verifies chamber counts, exact universal d-squared, rational/finite-field Aomoto, cyclotomic arithmetic, the A3 fiber Betti numbers (1,7,18), and invalid-input rejection. Browser QA covers drawing through existing vertices, undo, chamber/matrix linking, representative vectors, Aomoto resonance, and Milnor eigenspaces.

## Sources

- Yoshinaga, *Minimality of hyperplane arrangements and basis of local system cohomology*, arXiv:1002.2038, §3.2.
- Yoshinaga, *q-deformation of Aomoto complex*, arXiv:2401.00810.
- Yoshinaga, *Milnor fibers of real line arrangements*, arXiv:1301.1430; *Resonant bands and local system cohomology groups for real line arrangements*, arXiv:1301.1888.
- Grünbaum, *A catalogue of simplicial arrangements in the real projective plane* (2009).
- Cuntz–Elia–Labbé, arXiv:2009.14152, and https://sophiasage.github.io/cn_hyperarr/doc/html/database.html. The A(7,1) realization is db_normals_CEL[(7,32,1)] deconed at z=0.

## v0.2: overview and asphericity

The overview distinguishes finite affine intersection multiplicities from projective multiplicities including the line at infinity. It displays the affine characteristic polynomial, the cone characteristic polynomial, Poincare polynomial, Euler characteristic, chamber counts and the projective face-degree distribution. Finite pairs and projective edge/chamber incidences are checked exactly.

The affine tope graph has one vertex for each affine chamber and Hamming-distance-one edges. The cone graph includes H-infinity, doubles the affine vertices into antipodal pairs and adds its H-infinity edges. Clickable nodes link back to the arrangement. Graph data and invariant data can be exported as JSON.

K(pi,1) targets the complexified affine complement. The cone complement is its product with C-star, so asphericity is equivalent. The report separates:

- **Deligne YES:** the rank-three cone is simplicial. Finite chamber walls are Hamming-distance-one affine tope neighbors. H-infinity is a wall precisely if the opposite affine sign vector also occurs.
- **Simple triangle NO:** a projective three-wall chamber has only double vertices, and there are at least four projective lines.
- **Yoshinaga NO:** a sign vector is feasible on every rank-two triple but is not an actual chamber. H-infinity's sign is fixed positive during exhaustive search. An exact linear dependence on each rank-two triple gives its two forbidden sign patterns. Equality sigma_2=sigma_3 is only a necessary condition.
- **Falk YES:** Corollary 3.10, using all bounded edges, including those that do not bound any bounded chamber. The local link has bounded edges as vertices and bounded-face corners as edges. Its largest component cardinality d(v), together with line multiplicity m(v), defines the exact balanced corner weight. Every bounded face must have weight sum at most its number of vertices minus two.
- **Additional YES:** cone rank at most two, or a rank-three modular point (supersolvable/fiber-type).

An unsuccessful sufficient test or a passed necessary test is not the opposite verdict. A conflict between positive and negative certificates raises an error and withholds classification. Falk's 11-line example is intentionally included: its K(pi,1) property is known by nonuniform weights, but this restricted automated suite returns UNKNOWN. The literature result is shown separately.

New references: Deligne (1972), https://publications.ias.edu/sites/default/files/Number18.pdf ; Falk (1995), DOI 10.1016/0040-9383(94)E0011-8, Cor.3.10 and Example3.13; Yoshinaga arXiv:2405.20010 Theorem5.1; Denham–Dorpalen-Barry–Proudfoot arXiv:2512.10077 section2.1; Falk–Randell simple triangle as restated in Cuntz–Kuehne, DOI 10.1007/s13366-026-00858-6 Lemma7.4. Catalogue normals and labels are transcribed from Cuntz–Elia–Labbe, Tables5–8, https://d-nb.info/1250074576/34 .

Run `npm test` for both the original cohomology tests and the new invariant/topology tests. The latter compare to the published catalogue, independently verify tope shortest paths against Hamming distance, and exercise YES, NO and UNKNOWN, flag changes and an exact tiny perturbation.

## v0.3: choose first, then inspect; multinets and Alexander orders

The arrangement picker is above the investigation workspace. The overview's line/chamber/Betti/Euler values are compact rather than dominant numerical cards.

`multinets.js` searches on exactly the selected projective support (all finite lines plus H-infinity by default). Subarrangements can be selected explicitly, including excluding infinity. It does not automatically enumerate all subarrangements. For nontrivial real arrangements it suffices to search three classes: Torielli–Yoshinaga Theorem2.2 and5.2 exclude higher-class genuine multinets. One-basepoint singleton pencils are reported separately from nontrivial degree>=2 structures.

The search first forces monochromatic components, then enumerates unlabeled three-class partitions. Each connected block's Cartan matrix is J-transpose J minus the all-ones matrix. A positive kernel must have dimension one; exact rational nullspaces determine primitive positive integral ratios. Equalized block degrees and all base-point sums and connectivity are reverified. Multiplicities are not bounded. Exhaustion certifies nonexistence on the chosen support; search/state/result limits yield UNKNOWN for unproved absence. Verified certificates color the diagram's lines by class and annotate weights. Nets, reduced multinets that are not nets, and nonreduced multinets are distinct results.

`alexander.js` computes the affine total-linking Alexander polynomial. Every finite meridian maps to1 and the infinity meridian maps to -n. The kernel of partial1 is identified with the last n-1 chamber coordinates because d0(t^-1)/(t^-1-1) has first entry1. Hence deleting the first row of partial2=d1(t^-1)-transpose gives a presentation over Q[t,t^-1]. Exact Laurent polynomial row/column reduction computes the order, with coefficient-growth guards and certified cyclotomic local-order calculations as a fast method for larger cases. The latter uses CDO nonresonance at infinity to bound possible orders by divisors of n and n-r (parallel-class size r>=2). Modular local orders are certified upper bounds; characteristic-zero local nullities/jet orders give lower bounds. Equal bounds prove multiplicities, including possible Jordan powers; sampled ranks alone are not substituted for polynomial multiplicities.

The polynomial is normalized as a primitive integer representative modulo a Laurent unit, with positive leading coefficient. A free Laurent-module part gives polynomial0, and its rank is displayed. This is not a computation of integral Alexander-module torsion. Exact integer cyclotomic factors and expanded coefficients are available, with residual-factor incompleteness explicitly reported if encountered.

The UI also displays the distinct cone polynomial: all n+1 meridians, including infinity, map to1. This is the Milnor-fiber H1 monodromy characteristic polynomial, computed through the existing exact cyclotomic routines. For A3 the affine polynomial is (t-1)^4(t^2+t+1), while the six-hyperplane cone polynomial is (t-1)^5(t^2+t+1). For four concurrent affine lines the affine polynomial is (t-1)^3(t+1)^2(t^2+1)^2 and the cone polynomial is (t-1)^4. Parallel affine lines provide the non-torsion/zero-polynomial case.

`npm test` now also runs exact multinet certificate/search-limit tests and Alexander order/factorization tests over every nonempty preset. The Alexander tests include a synthetic Jordan block where root-nullity1 must yield polynomial exponent2. Net fixtures include A3's (3,2)-net, B3's nonreduced (3,4)-multinet, and A(12,1)'s reduced multinet that is not a net.


## v0.4: exact special arrangements, jumping families, face posets, magnitude

The two new special arrangements use exact Q(sqrt(5)) arithmetic with the positive real embedding. The parser accepts rational/decimal literals, sqrt(5), √5, φ, parentheses and +,-,*,/. Algebraic ordering compares rational squares; approximate values are used only for drawing. Canonical exact strings round-trip through project JSON. Rational local-coefficient fields remain distinct from the geometry field.

The icosidodecahedral decone has 15 affine lines, projective t2=30,t4=15, affine chi=t²−15t+60, and76 chambers. Double star has10 affine lines, projective t2=10,t3=5,t4=5, chi=(t−5)², and36 chambers. The latter is an explicit subset of the former. The data directory includes exact primary coordinate changes and an independent six-edge-plane/ten-diagonal-plane geometric verification. An anisotropic affine change preserves incidence and topology, not regular Euclidean lengths/angles. Liu’s known K(pi,1) result for the icosidodecahedral arrangement is displayed separately from the restricted automated UNKNOWN result.

`face-poset.js` enumerates all affine faces and all coned covectors including H-infinity. Covers use X<=Y iff every nonzero sign of X agrees with Y. Cone covectors include opposite charts, infinity rays/sectors and one zero covector representing the entire common kernel in nonessential cases. The UI shows ambient dimensions, essential face ranks, localization ranks, f-vectors, covers, principal upper/lower intervals, an interactive Hasse diagram and JSON export. Finite faces highlight in the arrangement; infinity/kernel faces are identified explicitly.

`magnitude.js` uses Koizumi arXiv:2607.11863 Thm6.4, Cor6.6 and Prop6.9 for all finite real affine arrangements, including central/nonessential ones. Strict proper face-chain supports plus geometric repetition factors give the exact all-degree bigraded Hilbert series. MH over Z is torsion-free in all degrees, with ranks given by weak decreasing face flags. The table is a finite display box (k<=64,l<=128); outside groups are not asserted zero. Substituting u=-1 and reducing in Z[q] gives the exact rational magnitude for Z(q)[x,y]=q^distance(x,y). Distance-matrix formal inversion is an independent verification. Affine/cone graph mode is preserved throughout.

`net-jumping.js` validates each chosen multinet certificate and generates the 2-dimensional resonance subspace and character subtorus using rows (m,0),(0,m),(-m,-m), with 0 off support. The character equations use a saturated integer relation lattice; finite parameter kernels are recorded. Rational resonance points and cyclotomic characters are tested with the actual chamber complex and loaded into existing tabs. Pointed deletion families are also available. Liu–Xie arXiv:2409.04032 Thm2.1 supplies the separately labeled double-star translated component rho*(s^5,s^-5), rho=(1^5,-1^5), not produced by a pointed multinet. These are certified families/depth bounds and selected published components, not a full variety decomposition.

Additional suites cover exact quadratic cancellation/order and serialization, source-coordinate equivalence, covector axioms/strong elimination/face incidences, independent magnitude distance matrices and published A3 MH tables, independent OS isotropy and lattice saturation, Q/cyclotomic jumping samples, and pointed-deletion translated cosets. Browser QA verifies both special presets, face selections, MH table selection, parameter loading, and the double-star translated character with H1=1 over Q(zeta6).


## v0.5: computed jump ideals, extended fields, fundamental groups

Fixed the Milnor Euler display: the covering formula and alternating Betti sum are separate lines. For B3 the correct display is N=9, chi(M)=8, chi(F)=9*8=72 and 1-8+79=72. The previous code computed72 correctly but inserted it as a multiplier of the symbolic alternating sum.

`real-number-fields.js` adds exact arithmetic in a selected real embedding of Q[a]/p(a), with polynomial reduction/inversion and rational Sturm isolation. Signs use interval refinement; numbers are approximated only for drawing. Equal field definitions/root choices share canonical generators and round-trip strings. The30 new CEL examples give all66 published CEL/Grünbaum examples with at most21 projective lines; additional examples retain the affine20 limit. There are7 rational and23 algebraic new entries, using the golden-ratio, sqrt2, 2cos(2pi/7), 2cos(2pi/9), and the real root of x³−3x−25. Minimal polynomials/isolating intervals are visible beside the editor. Raw data is pinned to the authors’ database commit4620e43b0db7cbc4eafaa610d9b2c3dd211e5426 and independently recomputed with Python Fraction quotient fields (`test-extended-catalogue.py`).

The fundamental-group tab implements Yoshinaga2007 Appendix7 Theorem7.0.1 with one relation per ch². Each row uses R_C=product_j g_j^e_j product_j g_j^-e_j, both products in increasing j. An explicit Nielsen conversion gives the positive homogeneous meridian presentation of Yoshinaga2011 Theorem6.5. Every relator is checked by abelianized Fox derivatives against the existing chamber differential, up to one Laurent monomial unit per row. The tab shows abelianization, H2 of the group, the exact integral class-two lower-central quotient, finiteness/available abelianness, and only certified special-case centers/product structures. GAP/Sage/JSON exports preserve word conventions; the infinity meridian and extraZ factor for the cone are explicit.

The jump-locus tab now computes J1_k=I_(n-k+1)(d0 direct-sum d1)=Fitt_k(coker transpose(d0 direct-sum d1)). It does not confuse this cohomology jump ideal with the Fitting ideal of the universal H1 module. Scheme Gröbner generators and the radical’s irreducible components are separate collapsible results. Exact Singular4.4.1 precomputations include Laurent saturation, minimal prime decomposition, radical-power equality certificates and absolute C-primality via linearity or saturated binomial lattices. `compute-jump-cache.mjs` and exported Singular scripts reproduce the results. Cases without a complete certified cache use bounded exact sparse minor expansion and explicitly report incomplete generators or unresolved decomposition; missing components are never inferred absent.


Certified decomposition coverage in this release: both characteristic/resonance loci at every permitted depth for A3, generic4, finite pencil4, generic triangle and3x3grid (54 entries), plus depth1 resonance for B3 (19 components) and deletedB3 (12 components). The56 cached results are complete over C; no incomplete CAS candidate list is presented as a complete decomposition. Characteristic depth1 for B3/deletedB3, and the complete double-star decomposition, remain unresolved within the computation bound. The double-star published translated component remains available separately. For noncached inputs, actual exact polynomial minors are expanded up to resource limits, and the result distinguishes a full generator set from a partial set. Some exact schemes use the verified factorization J=Aug²*C, with all Aug/C generators and the implied product indexing displayed, rather than expanding thousands of redundant products.


## v0.5.1: explicit equation decomposition

Certified jumping-locus decompositions are displayed as a union of explicit equation-defined sets, with each component’s equations visible immediately. Simple monomial differences are transposed only for presentation (e.g. t2−t3=0 becomes t2=t3); the certified ideals are unchanged. Proof details and long scheme generators remain collapsible. Cached examples calculate automatically on entering the jump-loci tab. Plain-text and TeX exports give the actual union of equation-defined sets, including empty and whole-space cases; unresolved decompositions remain labeled unresolved.

## v0.6: diagram and line rotation

The view has a full-angle slider, 15-degree buttons and a zero reset. Flag alignment rotates the view so that all finite vertices lie above a horizontal flag, with the flag at 84% of the canvas height. If needed, the exact flag is first moved outside the vertices. Camera rotation leaves all arrangement coordinates unchanged. Clipping, chamber fills, grids, face overlays, panning and drawing share the same rotated projection and inverse.

In the line-rotation tool, drag a line or either circular handle about a selected exact pivot. The initial pivot is a nearby incident vertex, or the exact projection of a rational grid point if the line has no vertices. Click another incident vertex to choose it, or drag the orange pivot along the line. Shift snaps the displayed direction to 15-degree increments; arrow keys rotate by 1 degree (15 with Shift). Previewing does not recompute the model. Releasing commits one undoable edit, sets an adapted flag, and recomputes incidence, chambers and analysis. Escape/pointer cancellation discards the gesture. Direction components are rounded to bounded rational values; the pivot stays exact in the arrangement’s field.

`test-rotation.mjs` checks camera inverses, line clipping, horizontal-bottom alignment for all75 presets without coordinate mutation, exact pivot retention, half-turn identity, edited incidences and universal d1*d0=0. Browser QA verifies view rotation/alignment, direct line and handle drags, pivot movement, keyboard rotation, exact undo and chamber selection.

## v0.7: undo/redo, line deletion, intersection posets

Undo and redo are visible above the diagram, with up to50 snapshots in the current page session. Ctrl/Cmd-Z and Ctrl-Y or Cmd-Shift-Z work outside editable fields. Geometry edits, selected presets, flags, diagram rotation, zoom buttons and completed pans record snapshots of the model, camera and selected line. Slider gestures and line drags each produce one entry; a successful new edit clears redo, while failed/no-op edits retain it. Reloading resets this session’s history.

The line-selection tool highlights one complete line. The toolbar/inspector delete button or Delete/Backspace on the focused diagram removes it together with the corresponding monodromy exponents, complex monodromies and Aomoto weights. Exact equations, flag and parameter arrays are restored by undo. Removing the last line leaves a valid empty arrangement. Line rotation remains available for the selection.

The overview now includes affine/cone intersection-poset summaries and a dedicated explorer. It enumerates the nonempty affine flats, or the homogeneous cone flats including H-infinity, ordered by reverse inclusion. Closed sets of containing hyperplanes encode the order. Every Hasse cover, Möbius value, signed first-kind and second-kind Whitney number is explicit. Dimensions are affine/vector dimensions: cone rank-two elements are rays through projective points; the origin appears as a rank-three maximum only when the cone has rank3. Empty/parallel/nonessential arrangements retain their actual top flat.

Reports include essentialness, a maximum or all maximal elements, lattice/meet-semilattice structure, Boolean/modular/supersolvable properties and maximal-chain counts. In a lattice, every element’s modular rank identity is checked against every other element, with a counterexample when it fails; supersolvability includes a full modular maximal chain. Non-lattice affine posets do not receive lattice-only verdicts. The graph, searchable rank-filtered list, coordinates, containing hyperplanes and immediate neighbors link to the arrangement. A selected-element neighborhood view and full JSON export are available. Definitions follow Stanley’s arrangement lectures1,3–4 and SageMath’s intersection_poset convention, linked in the panel.

Validation: all75 exact presets agree with the existing characteristic polynomials and rank-three modular-point tests; deleting the infinity-containing flats recovers the affine poset. Small independent fixtures enumerate every subset of equations and recover closure via exact row reduction. Additional tests cover ranks0–3, Möbius inversion, Hasse covers, modular counterexamples/chains, deletion parameters, history limits and branches. Browser QA verifies deletion/undo/redo with distinct Aomoto weights, keyboard undo/Delete, last-line deletion, failed duplicate-input preservation of redo, diagram linkage, cone switching and infinity-flat searches.

## v0.8: distinct drawing icons and Plinth Lab

The Chamber drawing toolbar uses distinct code-native SVG icons and explicit labels for adding a line and selecting/deleting a line. The delete action has a trash icon. A top-level navigation now switches between Chamber Lab (`#chambers`) and an independent Plinth Lab (`#plinth`) in the same page. Models and edit histories are separate. Real results can be explicitly transferred back to Chamber Lab as an undoable edit; the selected line becomes the line at infinity via an exact projective decone.

Plinth Lab implements Guerville-Ballé’s projective construction: distinct supports Si and pivots Pi, with Pi off both adjacent supports; Q1(s,t)=sU+tV, Ei=Qi×Pi, and Qi+1=Ei×Si+1. Constant cross-product matrices keep every coordinate linear in s,t. The determinant of S1,E1,Er gives a binary quadratic closure condition. Its finite roots and roots at infinity are retained, with identity and double-root cases distinguished. A parameter’s sign or reciprocal may differ from the cited paper’s choice of basis; the displayed U,V and all exact coordinates fix the convention.

Arithmetic is exact over Q, a quadratic number field, or a quadratic tower of total degree4, including nonreal coefficients. A rational square-root test and the exact norm criterion for squares in a quadratic field determine splitting versus irreducibility. Degree-four base-field square-root problems are explicitly unresolved. Each candidate checks all added-line coincidences and the full projective intersection lattice against the expected pivot/corner/generic incidence pattern; sampled numerical ranks are never substituted for incidence. A rational nonsplitting witness is searched for separately.

Local rigidity is certified when a four-line projective frame exists and the exact incidence Jacobian has tangent dimension8, equal to the free PGL3 orbit dimension. Only a certified rigid base, two valid roots with identical labeled incidence, and a valid nonsplitting witness produce the automatic **ordered** moduli-separation verdict. Missing rigidity is not a negative verdict. Unordered moduli identification and a general embedded-topology/group-isomorphism decision are not implemented.

Eight presets reconstruct MacLane8, Falk–Sturmfels9, Nazir–Yoshinaga9, a splitting quadrilateral11, the rational13 and real FS13 nonarithmetic pairs, Rybnikov13, and the MacLane splitting11 (Table1, k=1). Source links identify Guerville-Ballé arXiv:2111.00399 §§3–4 and arXiv:2409.18022 §§3–4. Preset-specific known topology is shown only for an exact fingerprint of the published construction (including the conjugate base option). The MacLane11 example uses the quoted fundamental-group nonisomorphism theorem; the Rybnikov example additionally links arXiv:math/0403543. The 2024 paper’s rational/FS examples are reported as moduli/nonarithmetic pairs with topology left unclassified, exactly as its §4.3 states. Complex-conjugate MacLane/Nazir–Yoshinaga examples are not mislabeled as ordinary unmarked Zariski pairs.

Interactions include selecting support/pivots from controls or the diagram, exact-field base equation editing, drawing a line through two existing intersections, construction-step and parameter sliders, root/nonsplitting switching, conjugate bases, same-scale branch comparison, fitting the pivot/corner polygon or all intersections, and continuing with a constructed arrangement as the next base. Bounded pivot-tuple search for the chosen support runs in a cancellable Worker and never reports bounded failure as general nonexistence. Real examples use an actual affine chart; nonreal examples use the explicitly labeled line/point incidence graph. JSON saves the experiment plus exact certificates; SageMath exports exact number fields, coordinates and independent incidence assertions.

Real rational/quadratic results transfer to Chamber Lab for its existing computations. Additional real-field definitions persist with the Chamber model, so a new quadratic generator survives reload, undo and redo. Complex inputs and higher-degree bases are not silently converted to approximate real arrangements. Plinth inputs allow28 projective lines and polygon length3–8; Chamber transfers retain its affine20 limit.

`test-plinth.mjs` checks all eight examples and conjugate bases, independently compares the rational13/FS13 added equations to the paper, verifies every pair’s t-vector and pair count, checks Jacobian annihilation by an independently constructed rank-eight infinitesimal PGL orbit, round-trips exact quadratic towers, and tests genericity rejection, infinite roots and projective reparametrization. Transfers are checked by the existing chamber engine’s d1*d0 and projective multiplicities. Browser QA covers roots/comparison, nonsplitting parameters, the known Zariski example, construction steps, pivot search, line addition and its separate undo, plus real-field transfer/undo/redo/reload.

## v0.8.1: follow the splitting polygon one edge at a time

Presets open at Q1. Previous/next, first, completed view and direct step buttons reveal one added edge at a time. Each step identifies the starting corner, the pivot it passes through and the next support/corner with consistent green, gold and rose labels. The first point Q1 remains visible; the final return point R1 shares a circle/diamond marker when it coincides, or stays separate with a dashed comparison gap when it does not. Both exact homogeneous coordinate triples are shown side by side. A closed candidate is only called a splitting polygon after the existing exact genericity check passes.

The default camera fits corners so small polygons remain readable, with separate controls to include all pivots or all intersections. Off-screen pivots have directional callouts; infinite pivots use directions rather than finite dots. Completed real polygons have thick edges and a light fill. Complex examples use an explicitly labeled connection schematic; the full interactive incidence graph remains available in a disclosure. Real charts with infinite corners also show the schematic. The exact arithmetic, closure polynomial and certification logic are unchanged.

The Plinth checks additionally cover staged rendering for both branches of all eight examples, closure versus a nonsplitting witness, exact endpoint roles, all affine-chart choices, infinite-pivot directions and the corner-focused camera.
