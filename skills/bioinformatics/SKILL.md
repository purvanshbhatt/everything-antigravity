---
name: bioinformatics
disable-model-invocation: true
description: >-
  Bioinformatics workflow engineering: sequence and alignment formats
  (FASTA, FASTQ, SAM/BAM/CRAM, VCF, BED, GTF) and their coordinate systems,
  QC, alignment and variant-calling toolchains, Nextflow and nf-core or
  Snakemake pipelines, reference genome management, containers, cloud
  execution and reproducibility, with care for sensitive genomic data. Use
  when building or running sequencing analysis pipelines. Not medical advice.
---

# Bioinformatics Workflows

Most wrong biological results come from mismatched reference builds,
off-by-one coordinates, or an unpinned tool version, not from the science.
Pin everything, run under a workflow manager in containers, and QC at every
stage.

> Research engineering guidance only; not medical or diagnostic advice. Clinical use requires validated, accredited workflows and qualified professionals.

## When to use

- Building or running pipelines for DNA-seq, RNA-seq, single-cell or similar data.
- Converting between formats, or debugging coordinate and contig-name mismatches.
- Moving pipelines from a laptop to an HPC cluster or the cloud.
- Making an analysis reproducible for publication or handover.

## When not to use

- General numerical and statistical code: use `scientific-computing`.
- Notebook hygiene for downstream analysis: use `jupyter-notebooks`.
- Clinical data exchange (EHR, FHIR): use `healthcare-fhir`.
- Generic ETL orchestration (Airflow, Dagster): use `etl-pipelines`.

## Workflow

1. **Fix the reference first.** Choose the genome build (for example GRCh38) and annotation source and release (GENCODE, Ensembl or RefSeq), record download URLs and checksums, and settle contig naming (`chr1` versus `1`). Index once and store with a manifest.

   ```bash
   samtools faidx genome.fa
   md5sum genome.fa annotation.gtf > reference.md5    # PowerShell: Get-FileHash -Algorithm MD5
   ```

   **Check:** Every downstream file's header (BAM `@SQ`, VCF `##contig`) matches the reference's contig names and lengths.

2. **QC raw reads.** FastQC per file, fastp for adapter and quality trimming, MultiQC to aggregate. Record read counts at every stage.

   **Check:** A MultiQC report exists, and per-sample read counts reconcile across stages (no silent sample loss).

3. **Choose tools for the assay.** Short-read DNA: BWA-MEM2; long reads: minimap2; RNA-seq: STAR or HISAT2 for alignment, or salmon/kallisto for quantification; variants: GATK, DeepVariant or bcftools. Prefer an established nf-core pipeline over writing your own.

   ```bash
   nextflow run nf-core/rnaseq -r <release> -profile test,docker --outdir results_test   # smoke test
   nextflow run nf-core/rnaseq -r <release> -profile docker \
     --input samplesheet.csv --outdir results --fasta genome.fa --gtf annotation.gtf -resume
   ```

   **Check:** The pipeline release (`-r`) is pinned and the test profile passes on your infrastructure before real data runs.

4. **Write custom steps as workflow processes, not scripts.** One tool per process, explicit inputs and outputs, a container per process, resources declared.

   ```groovy
   process FASTQC {
       tag "$sample"
       container 'quay.io/biocontainers/fastqc:<pinned-tag>'
       input:
       tuple val(sample), path(reads)
       output:
       path "*_fastqc.{zip,html}"
       script:
       """
       fastqc --threads ${task.cpus} ${reads}
       """
   }

   workflow {
       Channel.fromFilePairs(params.reads, checkIfExists: true) | FASTQC
   }
   ```

   **Check:** The workflow resumes after interruption without recomputing finished steps.

5. **Handle alignments and variants with standard tools.**

   ```bash
   samtools sort -@ 8 -o sample.sorted.bam sample.bam
   samtools index sample.sorted.bam
   samtools flagstat sample.sorted.bam
   bcftools norm -f genome.fa -m -both calls.vcf.gz -Oz -o calls.norm.vcf.gz
   bcftools stats calls.norm.vcf.gz > calls.stats.txt
   ```

   **Check:** Mapping rate, duplication and variant statistics are within expected ranges for the assay, and outliers are explained.

6. **Run at scale.** Use executor profiles for HPC schedulers (SLURM) or cloud batch services (for example the `google-batch` executor on Google Cloud). Stage data in buckets in the same region as compute, and set budgets and alerts before large runs. Ask the user before launching runs with significant cost.

   **Check:** A cost estimate exists before the full run; the work directory is cleaned or lifecycle-managed afterwards.

7. **Protect sensitive data.** Human genomic data is highly identifying and often under controlled-access agreements and consent limits (and special-category data under GDPR). Keep it in access-controlled storage, log access, and never copy it to personal machines or public buckets.

   **Check:** Storage IAM and data-use agreements are documented for each dataset.

8. **Publish reproducibly.** Archive the pipeline version, parameters file, container digests, reference manifest, MultiQC report and Nextflow execution report and trace.

## Reference

### Coordinate systems (the classic off-by-one)

| Format | Base | Interval |
| :--- | :--- | :--- |
| BED | 0-based | Half-open `[start, end)` |
| GTF / GFF3 | 1-based | Closed `[start, end]` |
| VCF, SAM text | 1-based | Position of first base |
| BAM (binary) | 0-based internally | Tools convert for display |

BED `chr1 0 100` and GTF `chr1 ... 1 100` describe the same 100 bases.

### Formats

| Format | Content | Note |
| :--- | :--- | :--- |
| FASTA / FASTQ | Sequences / reads with qualities | Modern Illumina FASTQ uses Phred+33 |
| SAM / BAM / CRAM | Alignments | CRAM is smallest but needs the exact reference to decode |
| VCF / BCF | Variants | Normalize (left-align, split multiallelics) before comparing |
| BED / GTF / GFF3 | Intervals / annotations | Watch coordinate bases |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Mix GRCh37 and GRCh38 files | One build per project, checked in headers | Coordinates silently point to different bases |
| `conda install` tools ad hoc on the cluster | Pinned containers per process | Environment drift changes results |
| Chain tools with shell scripts | Nextflow or Snakemake with resume | Failures mid-run waste days of compute |
| Compare VCFs without normalization | `bcftools norm` with the reference first | Equivalent variants look different |
| Run unpinned `nextflow run` | Pin `-r` and record parameters | Pipelines change between releases |
| Copy patient-derived data to laptops | Access-controlled cloud or HPC storage | Breaches consent and data-use agreements |

## Verification checklist

- [ ] Reference build, annotation release, checksums and contig naming are recorded.
- [ ] QC reports exist and read counts reconcile across stages.
- [ ] Pipeline release, parameters and container digests are pinned.
- [ ] Coordinates are handled correctly across BED, GTF and VCF.
- [ ] Sensitive data stays in controlled storage under documented agreements.
- [ ] Execution reports and manifests are archived with results.

## Related

- Knowledge: `scientific-computing`, `jupyter-notebooks`, `docker-containers`, `cloud-storage-gcs`, `gdpr-privacy`, `etl-pipelines`, `data-quality`.
- Workflows: `/research-synthesis`, `/root-cause`.
- Agents: `data-engineer`, `python-reviewer`.
